// -- Other Library Imports --
import { create } from 'zustand';

// -- Utils Imports --
import { harmonizeData } from '@/lib/harmonization';

// -- Store Imports --
import { buildNewCharacter } from '@/lib/stores/characterStore';

// -- Local Imports --
import {
   SINGLE_ACTIVE_INSTANCE_ID,
   disposeInstance,
   getMenuFallbackInstance,
   getOrCreateInstance,
   setActiveInstance,
} from './characterStoreRegistry';
import { attachPersistenceHandle, detachPersistenceHandle, finishBootHydration } from './characterPersistence';
import { getCharacter } from './characterRepository';
import { getActiveCharacterId, setActiveCharacterId } from './characterSession';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * TabManager (tabs spec §1.2, §3) — owns the open/create/close lifecycle of
 * character tabs: instance creation/disposal, persistence-handle attach/detach,
 * the registry's active pointer, and the session pointer. The per-character store
 * actions (loadCharacter etc.) stay strictly per-character; the TabManager calls
 * them internally to populate or clear an instance, while the UI drives the
 * TabManager.
 *
 * PHASE 2 SINGLE-TAB CAP (the behavior-neutrality device): every open/create first
 * closes the current tab, so `openTabs.length <= 1` always and the UX is identical
 * to today (one character at a time). Phase 3 replaces the teardown-first policy
 * with focus-or-add and builds the strip; the typed `OpenTab[]` shape already
 * supports many.
 */

/** The kind of a tab. Only characters exist today; Boards/Notes are additive later (spec §1.2). */
export type TabType = 'character';

/** A tab in the workspace, in tab order. */
export interface OpenTab {
   /** For a character tab, the character id keying its store instance and handle. */
   id: string;
   /** Discriminant for the tab's content type. */
   type: TabType;
}

interface TabManagerState {
   /** Open tabs in order (Phase 2: at most one). */
   openTabs: OpenTab[];
   /** The active tab's id, or `null` when at the menu (the menu fallback instance is active). */
   activeTabId: string | null;
   actions: {
      /** Creates a brand-new character of `game`, opens it as the sole tab, and persists it. */
      createCharacterTab: (game: GameSystem) => void;
      /** Opens an existing/imported `character` (e.g. from the drawer or a file) as the sole tab. */
      openCharacterTab: (character: Character, drawerItemId?: string) => void;
      /** Closes the active character tab (flush → detach → dispose) and returns to the menu. */
      closeActiveTab: () => void;
      /** Activates an already-open tab by id (Phase 2: there is at most one). */
      setActiveTab: (id: string) => void;
   };
}

/**
 * Tears down the currently active character tab's instance: flush its pending save,
 * detach its persistence handle, then dispose the instance — in that order, since
 * flushing after detach would lose the last edit (tabs spec gotcha). No-op at the
 * menu (no active character tab).
 */
function teardownActiveTab(): void {
   const { activeTabId } = useTabManagerStore.getState();
   if (activeTabId === null) return;
   detachPersistenceHandle(activeTabId);
   disposeInstance(activeTabId);
}

/**
 * Points the registry active instance, the session pointer, and the tab state at
 * `id` as the single open character tab (Phase 2 cap).
 */
function focusCharacterAsOnlyTab(id: string): void {
   setActiveInstance(id);
   setActiveCharacterId(id);
   useTabManagerStore.setState({ openTabs: [{ id, type: 'character' }], activeTabId: id });
}

export const useTabManagerStore = create<TabManagerState>(() => ({
   openTabs: [],
   activeTabId: null,
   actions: {
      createCharacterTab: (game) => {
         teardownActiveTab();
         const character = buildNewCharacter(game);
         const instance = getOrCreateInstance(character.id);
         attachPersistenceHandle(character.id, instance);
         // Unguarded load: the handle's subscription autosaves the new character.
         instance.getState().actions.loadCharacter(character);
         focusCharacterAsOnlyTab(character.id);
      },
      openCharacterTab: (character, drawerItemId) => {
         teardownActiveTab();
         const instance = getOrCreateInstance(character.id);
         attachPersistenceHandle(character.id, instance);
         // Unguarded load: drawer/import content becomes an autosaved working record.
         instance.getState().actions.loadCharacter(character, drawerItemId);
         focusCharacterAsOnlyTab(character.id);
      },
      closeActiveTab: () => {
         teardownActiveTab();
         // Fall back to the menu instance so the root provider always has a store.
         getMenuFallbackInstance();
         setActiveInstance(SINGLE_ACTIVE_INSTANCE_ID);
         setActiveCharacterId(null);
         useTabManagerStore.setState({ openTabs: [], activeTabId: null });
      },
      setActiveTab: (id) => {
         const tab = useTabManagerStore.getState().openTabs.find((openTab) => openTab.id === id);
         if (!tab) return;
         setActiveInstance(id);
         setActiveCharacterId(id);
         useTabManagerStore.setState({ activeTabId: id });
      },
   },
}));

/** Selector hook for the TabManager action bag (a stable reference). */
export const useTabManagerActions = () => useTabManagerStore((state) => state.actions);

/**
 * Opens the stored character `id` as the sole tab on boot: reads its record,
 * harmonizes it, and hydrates it under the handle's guard so the just-restored state
 * is not redundantly written back to IndexedDB. Returns `false` when no record
 * exists (a stale pointer), so the caller can clear it.
 */
async function openCharacterTabFromStorage(id: string): Promise<boolean> {
   const record = await getCharacter(id);
   if (!record) return false;

   const harmonized = harmonizeData(record.character, 'FULL_CHARACTER_SHEET');
   const instance = getOrCreateInstance(id);
   const handle = attachPersistenceHandle(id, instance);
   handle.hydrate(harmonized, record.drawerItemId ?? undefined);
   focusCharacterAsOnlyTab(id); // the session pointer already equals `id`
   return true;
}

/**
 * Boot step run by `AppStartManager` after the character migration: read the single
 * session pointer and, if present, open that character into its id-keyed instance;
 * clear a stale pointer whose record no longer exists. Always lifts the boot loading
 * gate when done, so the shell resolves to the sheet or the menu without a flash.
 *
 * (Phase 2 still restores exactly one character; the `{ openTabs, activeId }`
 * workspace shape and restore-of-many arrive in Phase 3.)
 */
export async function runCharacterBoot(): Promise<void> {
   try {
      const id = getActiveCharacterId();
      if (id) {
         const opened = await openCharacterTabFromStorage(id);
         if (!opened) setActiveCharacterId(null);
      }
   } finally {
      finishBootHydration();
   }
}
