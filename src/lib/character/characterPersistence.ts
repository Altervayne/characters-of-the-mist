// -- Other Library Imports --
import { create } from 'zustand';

// -- Local Imports --
import { saveCharacter } from './characterRepository';
import { readWorkspace } from './workspaceSession';
import { legacyBlobHasMigratableCharacter } from './runCharacterMigration';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { CharacterStore } from '@/lib/stores/characterStore';

/*
 * Persistence sync layer (migration spec §3.3 / §5; tabs spec §2.1 / §3.1). It is
 * the only bridge between a pure in-memory character store instance and the
 * IndexedDB repository, and it is deliberately one-directional: state to IndexedDB.
 * Saving never calls the store's `set()`, so it creates no zundo entry and cannot
 * form a write loop (undo restores a snapshot via zundo's internal set, the save
 * subscription writes it once, and IndexedDB writes never feed back into store
 * state — exactly the desired behaviour, spec §4).
 *
 * As of Phase 2 persistence is **per-instance**: each open character tab owns a
 * {@link PersistenceHandle} (its own subscription, debounce timer, and hydration
 * flag), so one tab can never disturb another's save (tabs spec §2.1). The session
 * pointer and active-instance bookkeeping are the TabManager's concern, not this
 * module's. The menu fallback instance gets no handle.
 *
 * No UI here. The boot loading gate below is a tiny reactive flag the page shells
 * read to avoid flashing the main menu while the active character loads at boot.
 */

// ==================
//  Boot loading gate (spec §5, C-4)
// ==================

/**
 * Whether a character load is still pending at boot. Replaces persist's
 * (near-)synchronous rehydration: the IndexedDB load is async, so there is a
 * `character === null` window at boot during which the page shells must show a
 * neutral loading screen rather than the main menu.
 *
 * The initial value is computed synchronously before first paint: a present
 * session pointer means a character will be loaded; on the one-time pre-migration
 * launch the pointer is not set yet, so a still-migratable legacy blob also counts
 * (see {@link legacyBlobHasMigratableCharacter}).
 */
interface CharacterBootState {
   isBootHydrating: boolean;
}

function computeInitialBootExpectation(): boolean {
   // Any restorable open tab (workspace, which also back-seeds the legacy single-id
   // pointer) means a character will load; otherwise the one-time pre-migration blob.
   if (readWorkspace().openTabs.length > 0) return true;
   return legacyBlobHasMigratableCharacter();
}

export const useCharacterBootStore = create<CharacterBootState>(() => ({
   isBootHydrating: computeInitialBootExpectation(),
}));

/** Reactive selector for the boot loading gate, for the page shells. */
export const useIsBootHydrating = (): boolean => useCharacterBootStore((state) => state.isBootHydrating);

/** Marks boot hydration complete, so the shells stop showing the loading screen. Called by the TabManager's boot step. */
export function finishBootHydration(): void {
   useCharacterBootStore.setState({ isBootHydrating: false });
}

// ==================
//  Per-instance persistence handle (tabs spec §2.1, §3.1)
// ==================

const SAVE_DEBOUNCE_MS = 300;

/** A trailing-edge debouncer with an explicit `cancel`, so a handle can drop a pending save on detach. */
interface Debouncer<T> {
   (value: T): void;
   /** Cancels any pending invocation. */
   cancel(): void;
}

/** Builds a trailing-edge debouncer (no new dependency); at most one timer in flight. */
function createDebouncer<T>(delay: number, run: (value: T) => void): Debouncer<T> {
   let timer: ReturnType<typeof setTimeout> | null = null;
   const debounced = ((value: T) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
         timer = null;
         run(value);
      }, delay);
   }) as Debouncer<T>;
   debounced.cancel = () => {
      if (timer) {
         clearTimeout(timer);
         timer = null;
      }
   };
   return debounced;
}

/**
 * A per-instance persistence handle (tabs spec §3.1). Each open character tab owns
 * one: its own subscription, debounce timer, and hydration flag, so one tab's edits
 * can never cancel another tab's pending save nor suppress another tab's load.
 */
export interface PersistenceHandle {
   /**
    * Loads a character into the instance WITHOUT echoing it back to IndexedDB —
    * used for boot restore of a record that is already stored. Subsequent edits
    * autosave normally.
    */
   hydrate(character: Character, drawerItemId?: string): void;
   /** Writes the current character immediately, cancelling any pending debounce. Call before detach. */
   flush(): void;
   /** Cancels the pending debounce and unsubscribes. Does not save — call {@link PersistenceHandle.flush} first. */
   detach(): void;
}

/** Live handles keyed by character id, so attach is idempotent under StrictMode and double-open. */
const handles = new Map<string, PersistenceHandle>();

/**
 * Attaches (or returns the existing) per-instance persistence handle for `characterId`.
 * The handle subscribes to `instance` and debounce-saves the character on every
 * change; it does NOT touch the session pointer (the TabManager owns that). Attaching
 * twice for the same id returns the same handle (StrictMode-/double-open-safe).
 *
 * @param characterId - The character id keying both the instance and its handle.
 * @param instance - The store instance to persist.
 * @returns The persistence handle for that instance.
 */
export function attachPersistenceHandle(characterId: string, instance: CharacterStore): PersistenceHandle {
   const existing = handles.get(characterId);
   if (existing) return existing;

   let isHydrating = false;
   const debouncedSave = createDebouncer<Character>(SAVE_DEBOUNCE_MS, (character) => {
      void saveCharacter(character).catch((error) => {
         // Autosave is best-effort; a failure must never surface into the React tree.
         console.error('Character autosave to IndexedDB failed:', error);
      });
   });

   const unsubscribe = instance.subscribe((state, previousState) => {
      if (isHydrating) return;
      if (state.character === previousState.character) return;
      const character = state.character;
      if (character) debouncedSave(character);
   });

   const handle: PersistenceHandle = {
      hydrate(character, drawerItemId) {
         isHydrating = true;
         try {
            instance.getState().actions.loadCharacter(character, drawerItemId);
         } finally {
            isHydrating = false;
         }
      },
      flush() {
         debouncedSave.cancel();
         const character = instance.getState().character;
         if (character) {
            void saveCharacter(character).catch((error) => {
               console.error('Character flush save to IndexedDB failed:', error);
            });
         }
      },
      detach() {
         debouncedSave.cancel();
         unsubscribe();
      },
   };

   handles.set(characterId, handle);
   return handle;
}

/**
 * Flushes the pending save, detaches the subscription, and forgets the handle for
 * `characterId`. Idempotent. Call when closing a tab, BEFORE disposing its instance:
 * flush must run before detach or the last edit is lost (tabs spec gotcha).
 *
 * @param characterId - The character id whose handle to tear down.
 */
export function detachPersistenceHandle(characterId: string): void {
   const handle = handles.get(characterId);
   if (!handle) return;
   handle.flush();
   handle.detach();
   handles.delete(characterId);
}
