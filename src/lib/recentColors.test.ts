// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { pushRecentColor, readRecentColors } from './recentColors';

/*
 * Tests for the recent-colors store (the single-list port of Documinter's). The env is
 * Node, so an in-memory localStorage shim stands in for the browser's.
 */

function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   (globalThis as unknown as { localStorage: Storage }).localStorage = {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
   };
}

beforeEach(() => {
   installLocalStorageShim();
});

describe('recentColors', () => {
   it('starts empty and persists pushes (survives a fresh read)', () => {
      expect(readRecentColors()).toEqual([]);
      pushRecentColor('#112233');
      expect(readRecentColors()).toEqual(['#112233']);
   });

   it('keeps most-recent-first', () => {
      pushRecentColor('#aaaaaa');
      pushRecentColor('#bbbbbb');
      expect(readRecentColors()).toEqual(['#bbbbbb', '#aaaaaa']);
   });

   it('dedupes (move-to-front, lowercased)', () => {
      pushRecentColor('#aaaaaa');
      pushRecentColor('#bbbbbb');
      pushRecentColor('#AAAAAA'); // same as the first, different case
      expect(readRecentColors()).toEqual(['#aaaaaa', '#bbbbbb']);
   });

   it('caps the list at 9 entries', () => {
      for (let i = 0; i < 12; i++) pushRecentColor(`#0000${i.toString(16).padStart(2, '0')}`);
      expect(readRecentColors()).toHaveLength(9);
   });

   it('returns an empty list when the stored value is malformed', () => {
      localStorage.setItem('characters-of-the-mist_recent-colors', '{not json');
      expect(readRecentColors()).toEqual([]);
   });
});
