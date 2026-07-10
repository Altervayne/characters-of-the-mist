// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { createFolder, createItem, getNoteItemIdMap } from '@/lib/drawer/drawerRepository';
import { rehydrateBoardReferencedNotes, rewireBoardNoteReferences } from './importBoardReferencedNotes';
import { prepareImportedBoard } from './importBoardReferencedCharacters';

// -- Type Imports --
import type { Board, BoardItem, Note, NoteBoardContent } from '@/lib/types/board';

/*
 * Tests for the import-side note rehydrate + rewire: an imported board carries the full data of the notes
 * its reference tiles point at; here they become local drawer notes (linked when already present, recreated
 * keeping their id when absent) and the tiles are pointed at them. Dexie on fake-indexeddb.
 */

const FOLDER = 'Imported from My Board';

function makeEnsureFolder(name = FOLDER): () => Promise<string> {
   let id: string | null = null;
   return async () => {
      if (id === null) id = (await createFolder({ name, parentFolderId: null })).id;
      return id;
   };
}

function note(id: string, title = `Note ${id}`): Note {
   return { id, title, body: `body ${id}` };
}

function noteItem(id: string, content: NoteBoardContent): BoardItem {
   return { id, kind: 'note', x: 0, y: 0, width: 260, height: 320, z: 0, content };
}

function board(items: BoardItem[]): Board {
   return { id: 'b', name: 'My Board', viewport: { x: 0, y: 0, zoom: 1 }, items };
}

/** Seeds a saved local drawer note so a dedup lookup finds it. Returns its drawer item id. */
async function seedLocalNote(n: Note): Promise<string> {
   const record = await createItem({ name: n.title, game: 'NEUTRAL', type: 'NOTE', content: n, parentFolderId: null });
   return record.id;
}

beforeEach(async () => {
   await drawerDatabase.items.clear();
   await drawerDatabase.folders.clear();
});

describe('rehydrateBoardReferencedNotes', () => {
   it('recreates an absent note keeping its id, under the Imported-from folder', async () => {
      const n = note('nid-new');

      const map = await rehydrateBoardReferencedNotes({ 'nid-new': n }, makeEnsureFolder());

      const drawerItemId = map.get('nid-new')!;
      expect(drawerItemId).toBeDefined();
      const record = await drawerDatabase.items.get(drawerItemId);
      // The note id is preserved; the drawer item has its own (fresh) id.
      expect(record?.type).toBe('NOTE');
      expect(record?.id).not.toBe('nid-new');
      expect((record?.content as Note).id).toBe('nid-new');
      // It landed in the created folder.
      const folders = await drawerDatabase.folders.toArray();
      expect(folders.map((f) => f.name)).toEqual([FOLDER]);
      expect(record?.parentFolderId).toBe(folders[0].id);
   });

   it('links to an existing local note (no duplicate, not overwritten, folder untouched)', async () => {
      const existingItemId = await seedLocalNote(note('nid-have', 'Original Title'));

      const map = await rehydrateBoardReferencedNotes({ 'nid-have': note('nid-have', 'Edited Title') }, makeEnsureFolder());

      expect(map.get('nid-have')).toBe(existingItemId); // linked to the note already here
      expect(await drawerDatabase.items.count()).toBe(1); // no second note
      expect(await drawerDatabase.folders.count()).toBe(0); // no folder for a pure link
      const record = await drawerDatabase.items.get(existingItemId);
      expect(record?.name).toBe('Original Title'); // existing copy NOT overwritten by the file's version
   });

   it('creates the folder only when at least one note is new (pure links create none)', async () => {
      await seedLocalNote(note('nid-a'));
      const ensureFolder = makeEnsureFolder();

      await rehydrateBoardReferencedNotes({ 'nid-a': note('nid-a') }, ensureFolder);
      expect(await drawerDatabase.folders.count()).toBe(0);

      await rehydrateBoardReferencedNotes({ 'nid-a': note('nid-a'), 'nid-b': note('nid-b') }, ensureFolder);
      expect(await drawerDatabase.folders.count()).toBe(1);
   });

   it('returns an empty map when there is nothing embedded', async () => {
      expect((await rehydrateBoardReferencedNotes(undefined, makeEnsureFolder())).size).toBe(0);
   });

   it('getNoteItemIdMap maps saved note ids to their drawer item ids', async () => {
      const itemId = await seedLocalNote(note('nid-x'));
      expect((await getNoteItemIdMap()).get('nid-x')).toBe(itemId);
   });
});

describe('rewireBoardNoteReferences', () => {
   it('points each reference tile at its local drawer item and clears lastKnown, keeping noteId', () => {
      const input = board([noteItem('t1', { kind: 'note', mode: 'reference', noteId: 'nid-1', sourceDrawerItemId: 'stale', lastKnown: note('nid-1') })]);

      const result = rewireBoardNoteReferences(input, new Map([['nid-1', 'local-item-1']]));

      const content = result.items[0].content as NoteBoardContent;
      expect(content).toEqual({ kind: 'note', mode: 'reference', noteId: 'nid-1', sourceDrawerItemId: 'local-item-1' });
      expect((content as { lastKnown?: unknown }).lastKnown).toBeUndefined();
   });

   it('leaves a COPY tile untouched (self-contained, never rewired)', () => {
      const copy: NoteBoardContent = { kind: 'note', mode: 'copy', data: note('nid-copy') };
      const input = board([noteItem('t1', copy)]);

      const result = rewireBoardNoteReferences(input, new Map([['nid-copy', 'local-item-1']]));

      expect(result.items[0].content).toBe(copy); // same reference: untouched
   });

   it('leaves an unresolvable reference tile untouched (dangles gracefully)', () => {
      const original: NoteBoardContent = { kind: 'note', mode: 'reference', noteId: 'nid-gone', lastKnown: note('nid-gone') };
      const input = board([noteItem('t1', original)]);

      const result = rewireBoardNoteReferences(input, new Map());

      expect(result.items[0].content).toBe(original); // same reference: untouched
   });
});

describe('prepareImportedBoard (notes, end to end)', () => {
   it('recreates then rewires a reference tile to the new local drawer note (id preserved)', async () => {
      const n = note('nid-e2e');
      const input = board([noteItem('t1', { kind: 'note', mode: 'reference', noteId: 'nid-e2e', sourceDrawerItemId: 'foreign', lastKnown: n })]);

      const prepared = await prepareImportedBoard(input, { notes: { 'nid-e2e': n } }, FOLDER);

      const content = prepared.items[0].content as Extract<NoteBoardContent, { mode: 'reference' }>;
      expect(content.noteId).toBe('nid-e2e');
      // Rewired to the freshly created local drawer NOTE item holding the preserved-id note.
      const record = await drawerDatabase.items.get(content.sourceDrawerItemId!);
      expect(record?.type).toBe('NOTE');
      expect((record?.content as Note).id).toBe('nid-e2e');
      // The board itself got a fresh id (reIdBoardAggregate ran).
      expect(prepared.id).not.toBe('b');
   });

   it('re-importing the same board links the existing note (no duplicate)', async () => {
      const n = note('nid-twice');
      const input = () => board([noteItem('t1', { kind: 'note', mode: 'reference', noteId: 'nid-twice', sourceDrawerItemId: 'foreign', lastKnown: n })]);

      await prepareImportedBoard(input(), { notes: { 'nid-twice': n } }, FOLDER);
      await prepareImportedBoard(input(), { notes: { 'nid-twice': n } }, FOLDER);

      expect(await drawerDatabase.items.where('type').equals('NOTE').count()).toBe(1);
   });
});
