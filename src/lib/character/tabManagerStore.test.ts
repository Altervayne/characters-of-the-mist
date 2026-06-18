// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { useTabManagerStore, runCharacterBoot } from './tabManagerStore';
import {
   SINGLE_ACTIVE_INSTANCE_ID,
   disposeInstance,
   getActiveCharacterStore,
   getOrCreateInstance,
} from './characterStoreRegistry';
import { attachPersistenceHandle, detachPersistenceHandle, useCharacterBootStore } from './characterPersistence';
import { getCharacter, saveCharacter } from './characterRepository';
import { getActiveCharacterId, setActiveCharacterId } from './characterSession';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Tests for the TabManager lifecycle, the single-tab cap, per-instance persistence
 * isolation, and boot restore (tabs spec §1.2, §2.1, §3). Runs against
 * fake-indexeddb plus an in-memory localStorage shim for the session pointer.
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

const FIXTURE_IDS = ['boot-1', 'char-2', 'seq-x', 'seq-y', 'persist-A', 'persist-B', SINGLE_ACTIVE_INSTANCE_ID];

beforeEach(async () => {
   installLocalStorageShim();
   await drawerDatabase.characters.clear();
   await drawerDatabase.meta.clear();
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
});

afterEach(async () => {
   try {
      useTabManagerStore.getState().actions.closeActiveTab();
   } catch {
      // ignore; the test may have left no active tab
   }
   FIXTURE_IDS.forEach(disposeInstance);
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
   await new Promise((resolve) => setTimeout(resolve, 0)); // let any in-flight IDB write settle
});

describe('TabManager lifecycle', () => {
   it('createCharacterTab mints an id-keyed instance + active pointer + session pointer, and autosaves', async () => {
      useTabManagerStore.getState().actions.createCharacterTab('LEGENDS');

      const id = useTabManagerStore.getState().activeTabId;
      expect(id).toBeTruthy();
      expect(useTabManagerStore.getState().openTabs).toEqual([{ id, type: 'character' }]);
      // Active instance is the id-keyed one, holding the new character.
      expect(getActiveCharacterStore()).toBe(getOrCreateInstance(id!));
      expect(getOrCreateInstance(id!).getState().character?.id).toBe(id);
      // Session pointer set immediately; record autosaved after the debounce.
      expect(getActiveCharacterId()).toBe(id);
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(await getCharacter(id!)).toBeDefined();

      disposeInstance(id!);
   });

   it('openCharacterTab switches and disposes the previous tab (single-tab cap)', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.createCharacterTab('LEGENDS');
      const firstId = useTabManagerStore.getState().activeTabId!;
      const firstInstance = getOrCreateInstance(firstId);

      actions.openCharacterTab(makeCharacter('char-2', { name: 'Second' }));

      expect(useTabManagerStore.getState().activeTabId).toBe('char-2');
      expect(useTabManagerStore.getState().openTabs.length).toBe(1);
      expect(getActiveCharacterStore()).toBe(getOrCreateInstance('char-2'));
      // The previous instance was disposed: re-resolving its id yields a NEW instance.
      expect(getOrCreateInstance(firstId)).not.toBe(firstInstance);

      disposeInstance(firstId);
   });

   it('closeActiveTab disposes the tab and falls back to the menu instance with the pointer cleared', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.createCharacterTab('LEGENDS');
      const id = useTabManagerStore.getState().activeTabId!;
      const instance = getOrCreateInstance(id);

      actions.closeActiveTab();

      expect(useTabManagerStore.getState().openTabs).toEqual([]);
      expect(useTabManagerStore.getState().activeTabId).toBeNull();
      expect(getActiveCharacterId()).toBeNull();
      expect(getActiveCharacterStore()).toBe(getOrCreateInstance(SINGLE_ACTIVE_INSTANCE_ID));
      expect(getOrCreateInstance(id)).not.toBe(instance); // disposed
   });

   it('keeps at most one open tab through any sequence of opens/creates', () => {
      const actions = useTabManagerStore.getState().actions;
      actions.createCharacterTab('LEGENDS');
      actions.openCharacterTab(makeCharacter('seq-x'));
      actions.createCharacterTab('OTHERSCAPE');
      actions.openCharacterTab(makeCharacter('seq-y'));

      expect(useTabManagerStore.getState().openTabs.length).toBeLessThanOrEqual(1);
      expect(useTabManagerStore.getState().activeTabId).toBe('seq-y');
   });
});

describe('per-instance persistence isolation', () => {
   it('an edit + debounce on A writes A and never B', async () => {
      const a = getOrCreateInstance('persist-A');
      const b = getOrCreateInstance('persist-B');
      attachPersistenceHandle('persist-A', a);
      attachPersistenceHandle('persist-B', b);

      // Edit only A (a load is an observable change that schedules A's debounced save).
      a.getState().actions.loadCharacter(makeCharacter('persist-A', { name: 'Alpha' }));
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect((await getCharacter('persist-A'))?.character.name).toBe('Alpha');
      expect(await getCharacter('persist-B')).toBeUndefined();

      detachPersistenceHandle('persist-A');
      detachPersistenceHandle('persist-B');
   });
});

describe('boot restore', () => {
   it('opens the pointed character into its id-keyed instance and lifts the gate', async () => {
      await saveCharacter(makeCharacter('boot-1', { name: 'Booted' }));
      setActiveCharacterId('boot-1');
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      expect(useTabManagerStore.getState().activeTabId).toBe('boot-1');
      expect(getActiveCharacterStore()?.getState().character?.name).toBe('Booted');
      expect(useCharacterBootStore.getState().isBootHydrating).toBe(false);
   });

   it('clears a stale pointer and stays at the menu', async () => {
      setActiveCharacterId('missing-id');
      useCharacterBootStore.setState({ isBootHydrating: true });

      await runCharacterBoot();

      expect(getActiveCharacterId()).toBeNull();
      expect(useTabManagerStore.getState().activeTabId).toBeNull();
      expect(useCharacterBootStore.getState().isBootHydrating).toBe(false);
   });
});
