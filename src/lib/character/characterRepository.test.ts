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
   await drawerDatabase.items.clear();
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

describe('saveCharacterToLinkedDrawerItem (cross-store atomic save)', () => {
   /** Seeds a drawer FULL_CHARACTER_SHEET item linked to a character. */
   function seedLinkedDrawerItem(itemId: string, displayName: string, content: Character) {
      return drawerDatabase.items.add({
         id: itemId,
         name: displayName,
         parentFolderId: 'root',
         order: 0,
         game: content.game,
         type: 'FULL_CHARACTER_SHEET',
         createdAt: 0,
         updatedAt: 0,
         content,
      });
   }

   it('atomically upserts the working record AND updates the linked drawer item, preserving the item display name/placement', async () => {
      const before = makeCharacter('char-1', { name: 'Before', drawerItemId: 'item-1' });
      await seedLinkedDrawerItem('item-1', 'My Saved Hero', before);
      await repository.saveCharacter(before);

      const after = makeCharacter('char-1', { name: 'After', drawerItemId: 'item-1' });
      const result = await repository.saveCharacterToLinkedDrawerItem(after);

      expect(result.linkedItemUpdated).toBe(true);
      // Both stores reflect the save.
      expect((await repository.getCharacter('char-1'))?.character.name).toBe('After');
      const item = await drawerDatabase.items.get('item-1');
      expect((item?.content as Character).name).toBe('After');
      // The drawer item's own metadata (display name, parent, order) is untouched.
      expect(item?.name).toBe('My Saved Hero');
      expect(item?.parentFolderId).toBe('root');
      expect(item?.order).toBe(0);
   });

   it('reports linkedItemUpdated:false when the link is dangling (item deleted), still saving the working record', async () => {
      const orphan = makeCharacter('char-1', { name: 'Orphan', drawerItemId: 'item-gone' });
      const result = await repository.saveCharacterToLinkedDrawerItem(orphan);

      expect(result.linkedItemUpdated).toBe(false);
      // The working record is still persisted so the caller can route to Save-As.
      expect((await repository.getCharacter('char-1'))?.character.name).toBe('Orphan');
   });

   it('reports linkedItemUpdated:false when the character has no drawerItemId', async () => {
      const result = await repository.saveCharacterToLinkedDrawerItem(makeCharacter('char-1'));

      expect(result.linkedItemUpdated).toBe(false);
      expect(await repository.getCharacter('char-1')).toBeDefined();
   });
});
