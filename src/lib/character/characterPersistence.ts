// -- Other Library Imports --
import { create } from 'zustand';

// -- Utils Imports --
import { harmonizeData } from '@/lib/harmonization';

// -- Store Imports --
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Local Imports --
import { getCharacter, saveCharacter } from './characterRepository';
import { getActiveCharacterId, setActiveCharacterId } from './characterSession';
import { legacyBlobHasMigratableCharacter } from './runCharacterMigration';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Persistence sync layer (migration spec §3.3 / §5). It is the ONLY bridge between the
 * pure in-memory character store and the IndexedDB repository. It is deliberately
 * one-directional: state to IndexedDB. Saving never calls the store's `set()`, so it
 * creates no zundo entry and cannot form a write loop (undo restores a snapshot via
 * zundo's internal set, the save subscription writes it once, and IndexedDB writes
 * never feed back into store state, exactly the desired behaviour, spec §4).
 *
 * No UI here: it touches the store and the repository only. The boot loading gate
 * below is a tiny reactive flag that the page shells read to avoid flashing the
 * main menu while the active character is loaded asynchronously at boot.
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
   if (getActiveCharacterId() !== null) return true;
   return legacyBlobHasMigratableCharacter();
}

export const useCharacterBootStore = create<CharacterBootState>(() => ({
   isBootHydrating: computeInitialBootExpectation(),
}));

/** Reactive selector for the boot loading gate, for the page shells. */
export const useIsBootHydrating = (): boolean => useCharacterBootStore((state) => state.isBootHydrating);

/** Marks boot hydration complete, so the shells stop showing the loading screen. */
function finishBootHydration(): void {
   useCharacterBootStore.setState({ isBootHydrating: false });
}

// ==================
//  Hydration guard + debounced save
// ==================

/**
 * True only while {@link loadActiveCharacter} is applying a record to the store, so
 * the save subscription does not echo the freshly-loaded state straight back to
 * IndexedDB (the record is already there) nor rewrite the session pointer (already
 * correct). A plain module flag is sufficient: loads are not concurrent.
 */
let isHydrating = false;

/** Guards against attaching the store subscription more than once (StrictMode-safe). */
let persistenceStarted = false;

const SAVE_DEBOUNCE_MS = 300;

/** Minimal trailing-edge debouncer (no new dependency); one in-flight timer at a time. */
function createDebouncer<T>(delay: number, run: (value: T) => void): (value: T) => void {
   let handle: ReturnType<typeof setTimeout> | null = null;
   return (value: T) => {
      if (handle) clearTimeout(handle);
      handle = setTimeout(() => {
         handle = null;
         run(value);
      }, delay);
   };
}

const debouncedSave = createDebouncer<Character>(SAVE_DEBOUNCE_MS, (character) => {
   void saveCharacter(character).catch((error) => {
      // Autosave is best-effort; a failure must never surface into the React tree.
      console.error('Character autosave to IndexedDB failed:', error);
   });
});

// ==================
//  Load on open (spec §3.3 / §5)
// ==================

/**
 * Loads the character with `id` from IndexedDB into the store: read the record,
 * harmonize its content (load-time harmonization replaces the old persist
 * `migrate`), then apply it through the unchanged `loadCharacter` action (which
 * also resets the undo stack, C-2) under the {@link isHydrating} guard.
 *
 * @returns `true` when a record was found and loaded; `false` when no record exists
 *   for `id` (a stale pointer), so the caller can clear the pointer.
 */
export async function loadActiveCharacter(id: string): Promise<boolean> {
   const record = await getCharacter(id);
   if (!record) return false;

   const harmonized = harmonizeData(record.character, 'FULL_CHARACTER_SHEET');
   isHydrating = true;
   try {
      useCharacterStore.getState().actions.loadCharacter(harmonized, record.drawerItemId ?? undefined);
   } finally {
      isHydrating = false;
   }
   return true;
}

// ==================
//  Save on change (spec §3.3)
// ==================

/**
 * Attaches the one-directional save subscription (idempotent). On every character
 * change it keeps the session pointer in sync immediately (so a boot after an
 * abrupt close reopens the right character) and debounces the IndexedDB write. A
 * `null` character (return-to-menu) clears the pointer; the record itself remains
 * in IndexedDB (spec §5).
 */
export function startCharacterPersistence(): void {
   if (persistenceStarted) return;
   persistenceStarted = true;

   useCharacterStore.subscribe((state, previousState) => {
      if (isHydrating) return;
      if (state.character === previousState.character) return;

      const character = state.character;
      if (character) {
         if (getActiveCharacterId() !== character.id) setActiveCharacterId(character.id);
         debouncedSave(character);
      } else {
         setActiveCharacterId(null);
      }
   });
}

// ==================
//  Boot (spec §5)
// ==================

/**
 * Boot step run by `AppStartManager` after the character migration: read the
 * session pointer and, if present, load that character; clear a stale pointer whose
 * record no longer exists. Always lifts the boot loading gate when done, whatever
 * the outcome, so the shell resolves to the sheet or the main menu without a flash.
 */
export async function runCharacterBoot(): Promise<void> {
   try {
      const activeCharacterId = getActiveCharacterId();
      if (activeCharacterId) {
         const loaded = await loadActiveCharacter(activeCharacterId);
         if (!loaded) setActiveCharacterId(null);
      }
   } finally {
      finishBootHydration();
   }
}
