// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { useTabManagerStore, runCharacterBoot } from './tabManagerStore';
import {
   SINGLE_ACTIVE_INSTANCE_ID,
   disposeInstance,
   getActiveCharacterStore,
   getCharacterInstanceIds,
   getOrCreateInstance,
} from './characterStoreRegistry';
import { detachPersistenceHandle, useCharacterBootStore } from './characterPersistence';
import { saveCharacter } from './characterRepository';
import { readWorkspace, writeWorkspace, WORKSPACE_KEY } from './workspaceSession';
import { ACTIVE_CHARACTER_ID_KEY } from './characterSession';
import * as deviceTypeModule from '@/hooks/useDeviceType';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Tests for the Phase 3 multi-tab TabManager: lifted cap (keep-alive, focus-or-add),
 * workspace persistence + backward seed, and boot restore-of-many. Runs against
 * fake-indexeddb plus an in-memory localStorage shim.
 */

function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   (globalThis as unknown as { localStorage: Storage }).localStorage = {
      get length() {
         return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
   };
}

function makeCharacter(id: string, overrides: Partial<Character> = {}): Character {
   return {
      id,
      name: 'Hero',
      game: 'LEGENDS',
      cards: [],
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
      ...overrides,
   } as Character;
}

const FIXTURE_IDS = ['A', 'B', 'C', 'D', 'old', 'gone', SINGLE_ACTIVE_INSTANCE_ID];

beforeEach(async () => {
   installLocalStorageShim();
   await drawerDatabase.characters.clear();
   await drawerDatabase.meta.clear();
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
});

afterEach(async () => {
   vi.restoreAllMocks();
   FIXTURE_IDS.forEach((id) => {
      detachPersistenceHandle(id);
      disposeInstance(id);
   });
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
   await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('multi-tab lifecycle (keep-alive)', () => {
   it('opens three live tabs and switches active without disposing', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));
      actions.openCharacterTab(makeCharacter('C'));

      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B', 'C']);
      expect(useTabManagerStore.getState().activeTabId).toBe('C');

      const instA = getOrCreateInstance('A');
      const instC = getOrCreateInstance('C');

      actions.setActiveTab('A');
      expect(useTabManagerStore.getState().activeTabId).toBe('A');
      expect(getActiveCharacterStore()).toBe(instA);
      // Switching disposes nothing: A and C are the same instances as before.
      expect(getOrCreateInstance('C')).toBe(instC);
      expect(getOrCreateInstance('A')).toBe(instA);
   });

   it('closeTab disposes only that tab and activates a neighbour (right, else left, else menu)', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));
      actions.openCharacterTab(makeCharacter('C'));
      actions.setActiveTab('B');

      const instB = getOrCreateInstance('B');
      const instA = getOrCreateInstance('A');

      actions.closeTab('B');
      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'C']);
      expect(useTabManagerStore.getState().activeTabId).toBe('C'); // right neighbour
      expect(getOrCreateInstance('B')).not.toBe(instB); // B disposed (re-created here)
      expect(getOrCreateInstance('A')).toBe(instA); // A kept alive
      disposeInstance('B'); // clean up the re-created stub

      actions.closeTab('C'); // active, rightmost → left neighbour A
      expect(useTabManagerStore.getState().activeTabId).toBe('A');

      actions.closeTab('A'); // last tab → menu fallback
      expect(useTabManagerStore.getState().openTabs).toEqual([]);
      expect(useTabManagerStore.getState().activeTabId).toBeNull();
      expect(getActiveCharacterStore()).toBe(getOrCreateInstance(SINGLE_ACTIVE_INSTANCE_ID));
   });

   it('closing a background tab leaves the active tab untouched', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));
      actions.setActiveTab('B');
      const instB = getOrCreateInstance('B');

      actions.closeTab('A'); // background

      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['B']);
      expect(useTabManagerStore.getState().activeTabId).toBe('B');
      expect(getOrCreateInstance('B')).toBe(instB);
   });
});

describe('focus-or-add', () => {
   it('focuses an already-open character without reloading it (state + undo preserved)', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A', { name: 'Original' }));
      const instA = getOrCreateInstance('A');
      instA.getState().actions.updateCharacterName('Edited');
      const pastBefore = instA.temporal.getState().pastStates.length;

      // Re-open the same id with different content → must focus, not rebuild.
      actions.openCharacterTab(makeCharacter('B'));
      actions.openCharacterTab(makeCharacter('A', { name: 'WOULD-CLOBBER' }));

      expect(getOrCreateInstance('A')).toBe(instA); // same instance
      expect(instA.getState().character?.name).toBe('Edited'); // not reloaded
      expect(instA.temporal.getState().pastStates.length).toBe(pastBefore); // undo intact
      expect(useTabManagerStore.getState().activeTabId).toBe('A'); // focused
   });
});

describe('workspace persistence + backward seed', () => {
   it('persists the workspace on every mutating action', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));

      const persisted = readWorkspace();
      expect(persisted.openTabs.map((t) => t.id)).toEqual(['A', 'B']);
      expect(persisted.activeId).toBe('B');
   });

   it('seeds the workspace from a lone legacy pointer and removes the old key', () => {
      localStorage.setItem(ACTIVE_CHARACTER_ID_KEY, 'old');

      const seeded = readWorkspace();

      expect(seeded).toEqual({ openTabs: [{ id: 'old', type: 'character' }], activeId: 'old' });
      expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
      expect(localStorage.getItem(ACTIVE_CHARACTER_ID_KEY)).toBeNull();
   });
});

describe('boot restore-of-many', () => {
   it('opens every stored tab in order, prunes a stale one, activates the stored active, and lifts the gate', async () => {
      await saveCharacter(makeCharacter('A', { name: 'Alpha' }));
      await saveCharacter(makeCharacter('B', { name: 'Bravo' }));
      await saveCharacter(makeCharacter('C', { name: 'Charlie' }));
      writeWorkspace({
         openTabs: [
            { id: 'A', type: 'character' },
            { id: 'gone', type: 'character' }, // stale: no record
            { id: 'B', type: 'character' },
            { id: 'C', type: 'character' },
         ],
         activeId: 'B',
      });
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B', 'C']); // order preserved, 'gone' pruned
      expect(useTabManagerStore.getState().activeTabId).toBe('B');
      expect(getActiveCharacterStore()?.getState().character?.name).toBe('Bravo');
      expect(useCharacterBootStore.getState().isBootHydrating).toBe(false);
      // Pruned workspace persisted.
      expect(readWorkspace().openTabs.map((t) => t.id)).toEqual(['A', 'B', 'C']);
   });

   it('falls back to the menu and lifts the gate when no stored tab survives', async () => {
      writeWorkspace({ openTabs: [{ id: 'gone', type: 'character' }], activeId: 'gone' });
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      expect(useTabManagerStore.getState().openTabs).toEqual([]);
      expect(useTabManagerStore.getState().activeTabId).toBeNull();
      expect(useCharacterBootStore.getState().isBootHydrating).toBe(false);
   });
});

describe('desktop deactivate (Return to Menu, keep tabs)', () => {
   it('clears the active id and points at the menu fallback while keeping tabs + the live instance', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));
      const instB = getOrCreateInstance('B');

      actions.deactivate();

      expect(useTabManagerStore.getState().activeTabId).toBeNull();
      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B']); // tabs kept
      expect(getActiveCharacterStore()).toBe(getOrCreateInstance(SINGLE_ACTIVE_INSTANCE_ID)); // menu active
      expect(getOrCreateInstance('B')).toBe(instB); // previously-active instance still live
      expect(readWorkspace().activeId).toBeNull(); // persisted

      // Reactivating returns to the same live instance.
      actions.setActiveTab('B');
      expect(getActiveCharacterStore()).toBe(instB);
   });
});

describe('mobile single-live lifecycle', () => {
   it('keeps exactly one live character instance across opens/creates, never pruning openTabs', () => {
      const actions = useTabManagerStore.getState().actions;

      actions.mobileOpenCharacter(makeCharacter('A'));
      expect(getCharacterInstanceIds()).toEqual(['A']);

      actions.mobileCreateCharacter('LEGENDS');
      const created = useTabManagerStore.getState().activeTabId!;
      // A's instance is gone, only the new one is live; A stays in openTabs.
      expect(getCharacterInstanceIds()).toEqual([created]);
      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toContain('A');
      expect(useTabManagerStore.getState().openTabs.length).toBe(2);

      disposeInstance(created); // cleanup the minted instance
   });

   it('mobileReturnToMenu disposes the live instance, nulls active, and keeps openTabs', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.mobileOpenCharacter(makeCharacter('A'));
      actions.mobileOpenCharacter(makeCharacter('B'));

      actions.mobileReturnToMenu();

      expect(getCharacterInstanceIds()).toEqual([]); // no live character instance
      expect(useTabManagerStore.getState().activeTabId).toBeNull();
      expect(getActiveCharacterStore()).toBe(getOrCreateInstance(SINGLE_ACTIVE_INSTANCE_ID));
      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B']); // kept
   });
});

describe('platform-aware boot', () => {
   it('mobile boot hydrates only the active tab and keeps the full openTabs list', async () => {
      vi.spyOn(deviceTypeModule, 'getEffectiveDeviceType').mockReturnValue('mobile');
      await saveCharacter(makeCharacter('A', { name: 'Alpha' }));
      await saveCharacter(makeCharacter('B', { name: 'Bravo' }));
      await saveCharacter(makeCharacter('C', { name: 'Charlie' }));
      writeWorkspace({
         openTabs: [
            { id: 'A', type: 'character' },
            { id: 'B', type: 'character' },
            { id: 'C', type: 'character' },
         ],
         activeId: 'B',
      });
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      // The whole list is preserved, but only the active instance is live.
      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B', 'C']);
      expect(useTabManagerStore.getState().activeTabId).toBe('B');
      expect(getCharacterInstanceIds()).toEqual(['B']);
      expect(useCharacterBootStore.getState().isBootHydrating).toBe(false);
   });

   it('desktop boot hydrates all stored tabs', async () => {
      vi.spyOn(deviceTypeModule, 'getEffectiveDeviceType').mockReturnValue('desktop');
      await saveCharacter(makeCharacter('A'));
      await saveCharacter(makeCharacter('B'));
      await saveCharacter(makeCharacter('C'));
      writeWorkspace({
         openTabs: [
            { id: 'A', type: 'character' },
            { id: 'B', type: 'character' },
            { id: 'C', type: 'character' },
         ],
         activeId: 'A',
      });
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B', 'C']);
      expect(getCharacterInstanceIds().sort()).toEqual(['A', 'B', 'C']);
      expect(useTabManagerStore.getState().activeTabId).toBe('A');
   });

   it('desktop boot preserves a deactivated workspace (null active) as menu + all tabs hydrated', async () => {
      vi.spyOn(deviceTypeModule, 'getEffectiveDeviceType').mockReturnValue('desktop');
      await saveCharacter(makeCharacter('A'));
      await saveCharacter(makeCharacter('B'));
      // activeId null = the user hit "Return to Menu" (deactivated) before reloading.
      writeWorkspace({
         openTabs: [
            { id: 'A', type: 'character' },
            { id: 'B', type: 'character' },
         ],
         activeId: null,
      });
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      expect(useTabManagerStore.getState().activeTabId).toBeNull(); // stayed at the menu
      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B']); // tabs kept
      expect(getCharacterInstanceIds().sort()).toEqual(['A', 'B']); // all live (desktop keep-alive)
   });
});

describe('reorderTabs', () => {
   it('reorders openTabs and persists the new order, leaving the active tab unchanged', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));
      actions.openCharacterTab(makeCharacter('C'));
      actions.setActiveTab('A');

      actions.reorderTabs('A', 'C'); // move A to C's slot → [B, C, A]

      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['B', 'C', 'A']);
      expect(useTabManagerStore.getState().activeTabId).toBe('A'); // unchanged by a reorder
      expect(readWorkspace().openTabs.map((t) => t.id)).toEqual(['B', 'C', 'A']); // persisted
   });

   it('is a no-op when the ids match', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A'));
      actions.openCharacterTab(makeCharacter('B'));

      actions.reorderTabs('A', 'A');

      expect(useTabManagerStore.getState().openTabs.map((t) => t.id)).toEqual(['A', 'B']);
   });
});

describe('cross-tab undo isolation + routing', () => {
   it('undo on the active tab leaves the other tab untouched, and switching routes undo to the active tab', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.openCharacterTab(makeCharacter('A', { name: 'A0' }));
      actions.openCharacterTab(makeCharacter('B', { name: 'B0' })); // B is active
      const instA = getOrCreateInstance('A');
      const instB = getOrCreateInstance('B');

      // Edit B, then undo via the registry-resolved ACTIVE instance (exactly what the
      // Ctrl+Z router does in useCharacterSheetUndoRedo).
      instB.getState().actions.updateCharacterName('B1');
      const aPastBefore = instA.temporal.getState().pastStates.length;
      getActiveCharacterStore()!.temporal.getState().undo();

      expect(instB.getState().character?.name).toBe('B0'); // B reverted
      expect(instA.getState().character?.name).toBe('A0'); // A untouched
      expect(instA.temporal.getState().pastStates.length).toBe(aPastBefore); // A's undo stack untouched

      // Switch to A → undo now routes to A, not B.
      actions.setActiveTab('A');
      instA.getState().actions.updateCharacterName('A1');
      getActiveCharacterStore()!.temporal.getState().undo();

      expect(instA.getState().character?.name).toBe('A0'); // A reverted
      expect(instB.getState().character?.name).toBe('B0'); // B still unchanged
   });
});
