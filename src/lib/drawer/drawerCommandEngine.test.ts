// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from './drawerDatabase';
import * as repository from './drawerRepository';
import {
   createCreateFolderCommand,
   createCreateItemCommand,
   createDeleteFolderCommand,
   createDrawerCommandEngine,
   createImportDrawerAsFolderCommand,
   createMoveFolderCommand,
   createMoveItemCommand,
   createRenameFolderCommand,
   createReorderFoldersCommand,
   createReorderItemsCommand,
   createUpdateItemContentCommand,
} from './drawerCommandEngine';

// -- Type Imports --
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * Tests for the command/undo engine over the normalized repository (fake-indexeddb).
 * Each command's do/undo/redo round-trips DB state exactly; the engine's stack
 * behaviour (cap eviction, redo-clear) and reorder coalescing are covered with an
 * injected clock.
 */

const ITEM_CONTENT = { id: 'content', label: 'content' } as unknown as DrawerItemContent;

/** Convenience: ordered child folder ids of a parent (null = root). */
async function childFolderIds(parentFolderId: string | null): Promise<string[]> {
   return (await repository.getFolderChildren(parentFolderId)).folders.map((folder) => folder.id);
}

/** Convenience: ordered child item ids of a parent (null = root). */
async function childItemIds(parentFolderId: string | null): Promise<string[]> {
   return (await repository.getFolderChildren(parentFolderId)).items.map((item) => item.id);
}

beforeEach(async () => {
   await drawerDatabase.folders.clear();
   await drawerDatabase.items.clear();
   await drawerDatabase.meta.clear();
});

// ==================
//  Per-command do / undo / redo round-trips
// ==================

describe('command round-trips', () => {
   it('create folder: do adds, undo removes, redo re-adds with the same id', async () => {
      const engine = createDrawerCommandEngine();
      await engine.execute(createCreateFolderCommand({ name: 'New', parentFolderId: null }));

      const idsAfterCreate = await childFolderIds(null);
      expect(idsAfterCreate).toHaveLength(1);
      const createdId = idsAfterCreate[0];

      await engine.undo();
      expect(await childFolderIds(null)).toHaveLength(0);

      await engine.redo();
      expect(await childFolderIds(null)).toEqual([createdId]); // id-stable
   });

   it('create item: honours a preset id and keeps it stable across undo/redo', async () => {
      const engine = createDrawerCommandEngine();
      await engine.execute(
         createCreateItemCommand({ id: 'preset', name: 'Item', game: 'LEGENDS', type: 'FULL_CHARACTER_SHEET', content: ITEM_CONTENT, parentFolderId: null }),
      );
      expect(await repository.getItem('preset')).toBeDefined();

      await engine.undo();
      expect(await repository.getItem('preset')).toBeUndefined();

      await engine.redo();
      expect(await repository.getItem('preset')).toBeDefined();
   });

   it('rename folder: undo restores the previous name, redo re-applies', async () => {
      const folder = await repository.createFolder({ name: 'Old', parentFolderId: null });
      const engine = createDrawerCommandEngine();

      await engine.execute(createRenameFolderCommand(folder.id, 'New'));
      expect((await repository.getFolder(folder.id))?.name).toBe('New');

      await engine.undo();
      expect((await repository.getFolder(folder.id))?.name).toBe('Old');

      await engine.redo();
      expect((await repository.getFolder(folder.id))?.name).toBe('New');
   });

   it('move folder: undo restores original parent AND source order, redo re-moves', async () => {
      const source = await repository.createFolder({ name: 'Source', parentFolderId: null });
      const destination = await repository.createFolder({ name: 'Destination', parentFolderId: null });
      const moved = await repository.createFolder({ name: 'Moved', parentFolderId: source.id });
      const stays = await repository.createFolder({ name: 'Stays', parentFolderId: source.id });

      const engine = createDrawerCommandEngine();
      await engine.execute(createMoveFolderCommand(moved.id, destination.id));
      expect(await childFolderIds(source.id)).toEqual([stays.id]);
      expect(await childFolderIds(destination.id)).toEqual([moved.id]);

      await engine.undo();
      expect(await childFolderIds(source.id)).toEqual([moved.id, stays.id]); // exact original order
      expect(await childFolderIds(destination.id)).toEqual([]);

      await engine.redo();
      expect(await childFolderIds(source.id)).toEqual([stays.id]);
      expect(await childFolderIds(destination.id)).toEqual([moved.id]);
   });

   it('move item: undo restores original parent and order', async () => {
      const source = await repository.createFolder({ name: 'Src', parentFolderId: null });
      const destination = await repository.createFolder({ name: 'Dst', parentFolderId: null });
      const moved = await repository.createItem({ name: 'Moved', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: source.id });
      const stays = await repository.createItem({ name: 'Stays', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: source.id });

      const engine = createDrawerCommandEngine();
      await engine.execute(createMoveItemCommand(moved.id, destination.id));
      expect(await childItemIds(source.id)).toEqual([stays.id]);

      await engine.undo();
      expect(await childItemIds(source.id)).toEqual([moved.id, stays.id]);
   });

   it('delete folder: undo restores the entire subtree verbatim and the source order', async () => {
      const survivor = await repository.createFolder({ name: 'Survivor', parentFolderId: null });
      const doomed = await repository.createFolder({ name: 'Doomed', parentFolderId: null });
      const subFolder = await repository.createFolder({ name: 'Sub', parentFolderId: doomed.id });
      const deepItem = await repository.createItem({ name: 'Deep', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: subFolder.id });

      const before = await repository.exportEntireDrawerAsNestedTree();

      const engine = createDrawerCommandEngine();
      await engine.execute(createDeleteFolderCommand(doomed.id));
      expect(await repository.getFolder(doomed.id)).toBeUndefined();
      expect(await childFolderIds(null)).toEqual([survivor.id]); // reindexed

      await engine.undo();
      // Whole tree byte-for-byte restored (ids, order, content, nesting).
      expect(await repository.exportEntireDrawerAsNestedTree()).toStrictEqual(before);
      expect(await childFolderIds(null)).toEqual([survivor.id, doomed.id]); // original order
      expect(await repository.getItem(deepItem.id)).toBeDefined();

      await engine.redo();
      expect(await repository.getFolder(doomed.id)).toBeUndefined();
   });

   it('reorder folders: matches reorderList, undo restores, redo re-applies', async () => {
      const created = [];
      for (const name of ['A', 'B', 'C', 'D']) created.push(await repository.createFolder({ name, parentFolderId: null }));
      const ids = created.map((folder) => folder.id);

      const engine = createDrawerCommandEngine();
      await engine.execute(createReorderFoldersCommand(null, 0, 2));
      expect(await childFolderIds(null)).toEqual([ids[1], ids[2], ids[0], ids[3]]); // A -> index 2

      await engine.undo();
      expect(await childFolderIds(null)).toEqual(ids);

      await engine.redo();
      expect(await childFolderIds(null)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
   });

   it('update item content: undo restores prior content and name', async () => {
      const item = await repository.createItem({ name: 'Name', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });
      const nextContent = { id: 'next', label: 'next' } as unknown as DrawerItemContent;

      const engine = createDrawerCommandEngine();
      await engine.execute(createUpdateItemContentCommand(item.id, nextContent, 'Renamed'));
      expect(await repository.getItem(item.id)).toMatchObject({ name: 'Renamed', content: nextContent });

      await engine.undo();
      expect(await repository.getItem(item.id)).toMatchObject({ name: 'Name', content: ITEM_CONTENT });
   });

   it('import drawer as folder: undo deletes it, redo restores verbatim (id-stable)', async () => {
      const drawer = {
         folders: [{ id: 'orig-sub', name: 'Sub', items: [], folders: [] }],
         rootItems: [{ id: 'orig-item', game: 'LEGENDS' as const, type: 'CHARACTER_CARD' as const, name: 'Loose', content: ITEM_CONTENT }],
      };

      const engine = createDrawerCommandEngine();
      await engine.execute(createImportDrawerAsFolderCommand(drawer, 'Imported', null));
      const createdTopId = (await childFolderIds(null))[0];
      const subtreeAfterImport = await repository.getFolderSubtreeRecords(createdTopId);

      await engine.undo();
      expect(await childFolderIds(null)).toHaveLength(0);

      await engine.redo();
      expect(await childFolderIds(null)).toEqual([createdTopId]); // same id after redo
      expect(await repository.getFolderSubtreeRecords(createdTopId)).toStrictEqual(subtreeAfterImport);
   });
});

// ==================
//  Engine stack behaviour
// ==================

describe('engine stack', () => {
   it('caps the undo stack, dropping the oldest entry', async () => {
      const engine = createDrawerCommandEngine({ undoLimit: 2 });
      await engine.execute(createCreateFolderCommand({ name: 'First', parentFolderId: null }));
      await engine.execute(createCreateFolderCommand({ name: 'Second', parentFolderId: null }));
      await engine.execute(createCreateFolderCommand({ name: 'Third', parentFolderId: null }));

      // Only the two most recent are undoable; the first is evicted.
      await engine.undo();
      await engine.undo();
      expect(engine.canUndo()).toBe(false);

      // The first folder remains because its command was dropped from the stack.
      const remaining = await repository.getFolderChildren(null);
      expect(remaining.folders.map((folder) => folder.name)).toEqual(['First']);
   });

   it('clears the redo stack when a new command is executed', async () => {
      const engine = createDrawerCommandEngine();
      await engine.execute(createCreateFolderCommand({ name: 'A', parentFolderId: null }));
      await engine.undo();
      expect(engine.canRedo()).toBe(true);

      await engine.execute(createCreateFolderCommand({ name: 'B', parentFolderId: null }));
      expect(engine.canRedo()).toBe(false);
   });

   it('notifies subscribers and supports clear()', async () => {
      const engine = createDrawerCommandEngine();
      let notifications = 0;
      const unsubscribe = engine.subscribe(() => { notifications += 1; });

      await engine.execute(createCreateFolderCommand({ name: 'A', parentFolderId: null }));
      expect(notifications).toBeGreaterThan(0);

      engine.clear();
      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(false);

      unsubscribe();
      const countAfterUnsubscribe = notifications;
      await engine.execute(createCreateFolderCommand({ name: 'B', parentFolderId: null }));
      expect(notifications).toBe(countAfterUnsubscribe); // no longer notified
   });
});

// ==================
//  Coalescing
// ==================

describe('reorder coalescing', () => {
   it('collapses a burst within the window into a single undo step that returns to the pre-burst order', async () => {
      const created = [];
      for (const name of ['A', 'B', 'C', 'D']) created.push(await repository.createFolder({ name, parentFolderId: null }));
      const ids = created.map((folder) => folder.id);

      let clock = 1000;
      const engine = createDrawerCommandEngine({ now: () => clock });

      await engine.execute(createReorderFoldersCommand(null, 0, 1)); // [B,A,C,D]
      clock += 100; // within 600ms window
      await engine.execute(createReorderFoldersCommand(null, 0, 2)); // from [B,A,C,D] -> [A,C,B,D]

      expect(await childFolderIds(null)).toEqual([ids[0], ids[2], ids[1], ids[3]]); // latest "after"

      // A single undo returns all the way to the pre-burst order.
      await engine.undo();
      expect(await childFolderIds(null)).toEqual(ids);
      expect(engine.canUndo()).toBe(false); // the burst was one entry
   });

   it('does not coalesce when the window has elapsed', async () => {
      const created = [];
      for (const name of ['A', 'B', 'C', 'D']) created.push(await repository.createFolder({ name, parentFolderId: null }));
      const ids = created.map((folder) => folder.id);

      let clock = 0;
      const engine = createDrawerCommandEngine({ now: () => clock });

      await engine.execute(createReorderFoldersCommand(null, 0, 1)); // [B,A,C,D]
      clock += 700; // outside 600ms window
      await engine.execute(createReorderFoldersCommand(null, 0, 2)); // [A,C,B,D]

      // Two separate undo steps.
      await engine.undo();
      expect(await childFolderIds(null)).toEqual([ids[1], ids[0], ids[2], ids[3]]); // back to first "after"
      await engine.undo();
      expect(await childFolderIds(null)).toEqual(ids);
   });

   it('does not coalesce reorders of different parents', async () => {
      const folderOne = await repository.createFolder({ name: 'One', parentFolderId: null });
      const folderTwo = await repository.createFolder({ name: 'Two', parentFolderId: null });
      for (const name of ['A', 'B']) await repository.createItem({ name, game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: folderOne.id });
      for (const name of ['C', 'D']) await repository.createItem({ name, game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: folderTwo.id });

      let clock = 0;
      const engine = createDrawerCommandEngine({ now: () => clock });
      await engine.execute(createReorderItemsCommand(folderOne.id, 0, 1));
      clock += 100;
      await engine.execute(createReorderItemsCommand(folderTwo.id, 0, 1)); // different parent -> separate entry

      expect(engine.canUndo()).toBe(true);
      await engine.undo(); // undoes folderTwo only
      await engine.undo(); // undoes folderOne
      expect(engine.canUndo()).toBe(false);
   });
});
