// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { getActiveCharacterId, ACTIVE_CHARACTER_ID_KEY } from './characterSession';
import {
   CharacterMigrationError,
   LEGACY_CHARACTER_STORAGE_KEY,
   runCharacterMigrationIfNeeded,
   getCharacterLegacyBlobRemovalState,
   getLegacyCharacterForBackup,
   removeLegacyCharacterBlob,
} from './runCharacterMigration';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Tests for the one-time character blob -> IndexedDB migration against
 * fake-indexeddb plus an in-memory localStorage shim (Node provides neither
 * IndexedDB nor localStorage; fake-indexeddb/auto supplies the former via
 * setupFiles, this file supplies the latter).
 */

function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   const shim: Storage = {
      get length() {
         return store.size;
      },
      clear() {
         store.clear();
      },
      getItem(key: string) {
         return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
         return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
         store.delete(key);
      },
      setItem(key: string, value: string) {
         store.set(key, String(value));
      },
   };
   (globalThis as unknown as { localStorage: Storage }).localStorage = shim;
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

/** Writes a legacy zustand-persist character blob (`{ state: { character }, version }`). */
function seedLegacyBlob(character: Character | null): void {
   localStorage.setItem(LEGACY_CHARACTER_STORAGE_KEY, JSON.stringify({ state: { character }, version: 3 }));
}

beforeEach(async () => {
   installLocalStorageShim();
   await drawerDatabase.characters.clear();
   await drawerDatabase.meta.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

describe('character migration', () => {
   it('migrates a faithful character: record written (id/content preserved), flags + active pointer set, blob retained', async () => {
      seedLegacyBlob(makeCharacter('char-1', { name: 'Aria', game: 'OTHERSCAPE', drawerItemId: 'item-9' }));

      const outcome = await runCharacterMigrationIfNeeded();
      expect(outcome).toBe('migrated');

      const record = await drawerDatabase.characters.get('char-1');
      expect(record).toMatchObject({ id: 'char-1', name: 'Aria', game: 'OTHERSCAPE', drawerItemId: 'item-9' });
      expect(record?.character.id).toBe('char-1');

      expect((await drawerDatabase.meta.get('characterMigrationStatus'))?.value).toBe('completed');
      expect((await drawerDatabase.meta.get('characterMigrationVerified'))?.value).toBe(true);
      expect((await drawerDatabase.meta.get('characterMigratedRecordCount'))?.value).toBe(1);
      expect((await drawerDatabase.meta.get('characterLegacyBlobRetainedUntil'))?.value).toBeTruthy();

      // Reopens to the migrated character; legacy blob retained.
      expect(getActiveCharacterId()).toBe('char-1');
      expect(localStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY)).not.toBeNull();
   });

   it('fails closed when verification mismatches: not verified, blob retained, but data still written', async () => {
      // Force the verify read-back to return a tampered character.
      vi.spyOn(drawerDatabase.characters, 'get').mockResolvedValueOnce(
         { id: 'char-1', name: 'Hero', game: 'LEGENDS', updatedAt: 0, drawerItemId: null, schemaVersion: 1, character: makeCharacter('char-1', { name: 'TAMPERED' }) },
      );
      seedLegacyBlob(makeCharacter('char-1'));

      await expect(runCharacterMigrationIfNeeded()).rejects.toBeInstanceOf(CharacterMigrationError);

      // Migrated + completed, but NOT verified → removal never offered; blob retained.
      expect((await drawerDatabase.meta.get('characterMigrationStatus'))?.value).toBe('completed');
      expect(await drawerDatabase.meta.get('characterMigrationVerified')).toBeUndefined();
      expect(localStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY)).not.toBeNull();
   });

   it('is a no-op on a second run (gated on the completion flag)', async () => {
      seedLegacyBlob(makeCharacter('char-1'));
      expect(await runCharacterMigrationIfNeeded()).toBe('migrated');

      // A different blob must NOT be re-imported once completed.
      seedLegacyBlob(makeCharacter('char-2', { name: 'Should Not Import' }));
      expect(await runCharacterMigrationIfNeeded()).toBe('already-completed');

      expect(await drawerDatabase.characters.count()).toBe(1);
      expect(await drawerDatabase.characters.get('char-2')).toBeUndefined();
   });

   it('de-duplicates concurrent (StrictMode) invocations into one migration', async () => {
      seedLegacyBlob(makeCharacter('char-1'));
      const [first, second] = await Promise.all([runCharacterMigrationIfNeeded(), runCharacterMigrationIfNeeded()]);
      expect(first).toBe('migrated');
      expect(second).toBe('migrated');
      expect(await drawerDatabase.characters.count()).toBe(1);
   });

   it('marks completion without a record on a fresh install (no blob)', async () => {
      const outcome = await runCharacterMigrationIfNeeded();
      expect(outcome).toBe('fresh-install');
      expect((await drawerDatabase.meta.get('characterMigrationStatus'))?.value).toBe('completed');
      expect(await drawerDatabase.characters.count()).toBe(0);
      expect(localStorage.getItem(ACTIVE_CHARACTER_ID_KEY)).toBeNull();
   });

   it('marks completion without a record when the blob has no active character', async () => {
      seedLegacyBlob(null);
      const outcome = await runCharacterMigrationIfNeeded();
      expect(outcome).toBe('fresh-install');
      expect(await drawerDatabase.characters.count()).toBe(0);
   });
});

describe('character legacy-blob removal (user-data-safe)', () => {
   it('is not removable when the blob is absent', async () => {
      expect(await getCharacterLegacyBlobRemovalState()).toEqual({ removable: false, blobPresent: false });
   });

   it('is NOT removable when migrated but not verified (fail-safe keeps the blob)', async () => {
      seedLegacyBlob(makeCharacter('char-1'));
      await drawerDatabase.meta.put({ key: 'characterMigrationStatus', value: 'completed' });
      // characterMigrationVerified intentionally unset (e.g. an early/failed verification).

      expect(await getCharacterLegacyBlobRemovalState()).toEqual({ removable: false, blobPresent: true });
   });

   it('is removable only after a verified migration; removal drops the blob + marker but keeps the data', async () => {
      seedLegacyBlob(makeCharacter('char-1', { name: 'Aria' }));
      await runCharacterMigrationIfNeeded(); // completed + verified + retained marker

      expect(await getCharacterLegacyBlobRemovalState()).toEqual({ removable: true, blobPresent: true });
      // A faithful backup can be produced before any deletion.
      expect(getLegacyCharacterForBackup()?.name).toBe('Aria');

      await removeLegacyCharacterBlob();

      // Blob gone and marker dropped, but the migrated record survives untouched.
      expect(localStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY)).toBeNull();
      expect(await drawerDatabase.meta.get('characterLegacyBlobRetainedUntil')).toBeUndefined();
      expect(await drawerDatabase.characters.get('char-1')).toBeDefined();
      // No longer offered once removed.
      expect(await getCharacterLegacyBlobRemovalState()).toEqual({ removable: false, blobPresent: false });
   });
});
