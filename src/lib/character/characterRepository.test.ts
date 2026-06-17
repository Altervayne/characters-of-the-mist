// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import * as repository from './characterRepository';
import { CHARACTER_SCHEMA_VERSION } from './characterRecords';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Unit tests for the character repository against fake-indexeddb. Covers CRUD,
 * the reverse-link lookup, metadata derivation, and upsert semantics.
 */

/** Builds a minimal valid character. */
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

beforeEach(async () => {
   await drawerDatabase.characters.clear();
   await drawerDatabase.meta.clear();
});

describe('character repository', () => {
   it('saves a character, deriving denormalized metadata from it', async () => {
      const character = makeCharacter('char-1', { name: 'Aria', game: 'OTHERSCAPE', drawerItemId: 'item-9' });

      const record = await repository.saveCharacter(character);

      expect(record).toMatchObject({
         id: 'char-1',
         name: 'Aria',
         game: 'OTHERSCAPE',
         drawerItemId: 'item-9',
         schemaVersion: CHARACTER_SCHEMA_VERSION,
      });
      expect(typeof record.updatedAt).toBe('number');
      expect((await repository.getCharacter('char-1'))?.character.name).toBe('Aria');
   });

   it('defaults drawerItemId to null when the character has none', async () => {
      await repository.saveCharacter(makeCharacter('char-1'));
      expect((await repository.getCharacter('char-1'))?.drawerItemId).toBeNull();
   });

   it('upserts on the same id (one row), refreshing metadata and updatedAt', async () => {
      const first = await repository.saveCharacter(makeCharacter('char-1', { name: 'Old' }));
      await new Promise((resolve) => setTimeout(resolve, 2)); // ensure a later timestamp
      const second = await repository.saveCharacter(makeCharacter('char-1', { name: 'New' }));

      expect(await drawerDatabase.characters.count()).toBe(1);
      expect((await repository.getCharacter('char-1'))?.name).toBe('New');
      expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
   });

   it('looks up a character by its linked drawer item id (reverse index)', async () => {
      await repository.saveCharacter(makeCharacter('char-1', { drawerItemId: 'item-A' }));
      await repository.saveCharacter(makeCharacter('char-2', { drawerItemId: 'item-B' }));

      expect((await repository.getCharacterByDrawerItemId('item-B'))?.id).toBe('char-2');
      expect(await repository.getCharacterByDrawerItemId('item-missing')).toBeUndefined();
   });

   it('lists characters most-recently-updated first', async () => {
      await repository.saveCharacter(makeCharacter('char-1', { name: 'First' }));
      await new Promise((resolve) => setTimeout(resolve, 2));
      await repository.saveCharacter(makeCharacter('char-2', { name: 'Second' }));

      const ids = (await repository.listCharacters()).map((record) => record.id);
      expect(ids).toEqual(['char-2', 'char-1']);
   });

   it('deletes a character and is idempotent for a missing id', async () => {
      await repository.saveCharacter(makeCharacter('char-1'));
      await repository.deleteCharacter('char-1');
      expect(await repository.getCharacter('char-1')).toBeUndefined();
      await repository.deleteCharacter('char-1'); // no throw
   });

   it('clearAllCharacterData clears characters but preserves meta', async () => {
      await repository.saveCharacter(makeCharacter('char-1'));
      await drawerDatabase.meta.put({ key: 'characterMigrationStatus', value: 'completed' });

      await repository.clearAllCharacterData();

      expect(await drawerDatabase.characters.count()).toBe(0);
      // Migration flag must survive so a retained legacy blob is not re-imported.
      expect((await drawerDatabase.meta.get('characterMigrationStatus'))?.value).toBe('completed');
   });
});
