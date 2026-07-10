// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { createFolder, createItem, getCharacterItemIdMap } from '@/lib/drawer/drawerRepository';
import {
   prepareImportedBoard,
   rehydrateBoardReferencedCharacters,
   rewireBoardCharacterElements,
} from './importBoardReferencedCharacters';

// -- Type Imports --
import type { Board, BoardItem, CharacterBoardContent } from '@/lib/types/board';
import type { Character } from '@/lib/types/character';

/*
 * Tests for the import-side rehydrate + rewire: an imported board carries the full data of the
 * characters its elements reference; here they become local characters (linked when already present,
 * recreated keeping their id when absent) and the elements are pointed at them. Dexie on fake-indexeddb.
 */

const FOLDER = 'Imported from My Board';

/** A memoized lazy folder-ensurer, mirroring the one `prepareImportedBoard` passes the rehydrators. */
function makeEnsureFolder(name = FOLDER): () => Promise<string> {
   let id: string | null = null;
   return async () => {
      if (id === null) id = (await createFolder({ name, parentFolderId: null })).id;
      return id;
   };
}

function character(id: string, name = `Hero ${id}`): Character {
   return { id, name, game: 'LEGENDS', cards: [], trackers: { statuses: [], storyTags: [], storyThemes: [] } } as unknown as Character;
}

function charItem(id: string, content: CharacterBoardContent): BoardItem {
   return { id, kind: 'character', x: 0, y: 0, width: 0, height: 0, z: 0, content };
}

function board(items: BoardItem[]): Board {
   return { id: 'b', name: 'My Board', viewport: { x: 0, y: 0, zoom: 1 }, items };
}

/** Seeds a saved local character so a dedup lookup finds it. Returns its drawer item id. */
async function seedLocalCharacter(char: Character): Promise<string> {
   const record = await createItem({
      name: char.name, game: char.game, type: 'FULL_CHARACTER_SHEET', content: char, parentFolderId: null,
   });
   return record.id;
}

beforeEach(async () => {
   await drawerDatabase.items.clear();
   await drawerDatabase.folders.clear();
});

describe('rehydrateBoardReferencedCharacters', () => {
   it('recreates an absent character keeping its id, under an Imported-from folder', async () => {
      const char = character('cid-new');

      const map = await rehydrateBoardReferencedCharacters({ 'cid-new': char }, makeEnsureFolder());

      const drawerItemId = map.get('cid-new')!;
      expect(drawerItemId).toBeDefined();
      // The character id is preserved; the drawer item has its own id.
      const record = await drawerDatabase.items.get(drawerItemId);
      expect(record?.type).toBe('FULL_CHARACTER_SHEET');
      expect((record?.content as Character).id).toBe('cid-new');
      // The character links back to its drawer item so a later save resolves.
      expect((record?.content as Character).drawerItemId).toBe(drawerItemId);
      // It landed in the folder (which was created).
      const folders = await drawerDatabase.folders.toArray();
      expect(folders.map((f) => f.name)).toEqual([FOLDER]);
      expect(record?.parentFolderId).toBe(folders[0].id);
   });

   it('links to an existing local character (no duplicate, folder untouched)', async () => {
      const existingItemId = await seedLocalCharacter(character('cid-have'));

      const map = await rehydrateBoardReferencedCharacters({ 'cid-have': character('cid-have', 'Edited Name') }, makeEnsureFolder());

      // Linked to the character already here...
      expect(map.get('cid-have')).toBe(existingItemId);
      // ...no second character, and no folder created for a pure link.
      expect(await drawerDatabase.items.count()).toBe(1);
      expect(await drawerDatabase.folders.count()).toBe(0);
      // ...and the existing copy is NOT overwritten by the file's version.
      const record = await drawerDatabase.items.get(existingItemId);
      expect(record?.name).toBe('Hero cid-have');
   });

   it('creates the folder only when at least one character is new (pure links create none)', async () => {
      await seedLocalCharacter(character('cid-a'));
      const ensureFolder = makeEnsureFolder();

      await rehydrateBoardReferencedCharacters({ 'cid-a': character('cid-a') }, ensureFolder);
      expect(await drawerDatabase.folders.count()).toBe(0);

      await rehydrateBoardReferencedCharacters({ 'cid-a': character('cid-a'), 'cid-b': character('cid-b') }, ensureFolder);
      expect(await drawerDatabase.folders.count()).toBe(1);
   });

   it('returns an empty map when there is nothing embedded', async () => {
      expect((await rehydrateBoardReferencedCharacters(undefined, makeEnsureFolder())).size).toBe(0);
   });

   it('getCharacterItemIdMap maps saved character ids to their drawer item ids', async () => {
      const itemId = await seedLocalCharacter(character('cid-x'));
      expect((await getCharacterItemIdMap()).get('cid-x')).toBe(itemId);
   });
});

describe('rewireBoardCharacterElements', () => {
   it('points each element at its local drawer item and clears lastKnown, keeping characterId', () => {
      const input = board([charItem('e1', { kind: 'character', characterId: 'cid-1', sourceDrawerItemId: 'stale', lastKnown: character('cid-1') })]);

      const result = rewireBoardCharacterElements(input, new Map([['cid-1', 'local-item-1']]));

      const content = result.items[0].content as CharacterBoardContent;
      expect(content).toEqual({ kind: 'character', characterId: 'cid-1', sourceDrawerItemId: 'local-item-1' });
      expect(content.lastKnown).toBeUndefined();
   });

   it('rewires several elements pointing at one character to the same drawer item', () => {
      const input = board([
         charItem('e1', { kind: 'character', characterId: 'cid-1' }),
         charItem('e2', { kind: 'character', characterId: 'cid-1' }),
      ]);

      const result = rewireBoardCharacterElements(input, new Map([['cid-1', 'local-item-1']]));

      for (const item of result.items) {
         expect((item.content as CharacterBoardContent).sourceDrawerItemId).toBe('local-item-1');
      }
   });

   it('leaves an unresolvable element untouched (dangles gracefully)', () => {
      const original: CharacterBoardContent = { kind: 'character', characterId: 'cid-gone', lastKnown: character('cid-gone') };
      const input = board([charItem('e1', original)]);

      const result = rewireBoardCharacterElements(input, new Map());

      expect(result.items[0].content).toBe(original); // same reference: untouched
   });
});

describe('prepareImportedBoard (end to end)', () => {
   it('recreates then rewires: element points at the new local character (id preserved)', async () => {
      const char = character('cid-e2e');
      const input = board([charItem('e1', { kind: 'character', characterId: 'cid-e2e', sourceDrawerItemId: 'foreign', lastKnown: char })]);

      const prepared = await prepareImportedBoard(input, { characters: { 'cid-e2e': char } }, FOLDER);

      const content = prepared.items[0].content as CharacterBoardContent;
      expect(content.characterId).toBe('cid-e2e');
      // The rewired source is the freshly created local drawer item holding the preserved-id character.
      const record = await drawerDatabase.items.get(content.sourceDrawerItemId!);
      expect((record?.content as Character).id).toBe('cid-e2e');
      // The board itself got a fresh id (reIdBoardAggregate ran).
      expect(prepared.id).not.toBe('b');
   });

   it('re-importing the same board links the existing character (no duplicate)', async () => {
      const char = character('cid-twice');
      const input = () => board([charItem('e1', { kind: 'character', characterId: 'cid-twice', sourceDrawerItemId: 'foreign', lastKnown: char })]);

      await prepareImportedBoard(input(), { characters: { 'cid-twice': char } }, FOLDER);
      await prepareImportedBoard(input(), { characters: { 'cid-twice': char } }, FOLDER);

      // Only one character exists after two imports.
      expect(await drawerDatabase.items.where('type').equals('FULL_CHARACTER_SHEET').count()).toBe(1);
   });
});
