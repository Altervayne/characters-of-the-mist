// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Utils Imports --
import { reorderList } from '@/lib/utils/drawer';

// -- Local Imports --
import { drawerDatabase } from './drawerDatabase';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';
import { DrawerInvalidOperationError, DrawerNotFoundError, DrawerTransactionError } from './drawerErrors';
import * as repository from './drawerRepository';

// -- Type Imports --
import type { DrawerItem, DrawerItemContent, Folder } from '@/lib/types/drawer';

/*
 * Unit tests for the drawer repository against fake-indexeddb. They cross-check
 * the semantics the old `drawerStore` actions provided: ordered children,
 * breadcrumb walking, direct (non-recursive) counts, the self/descendant guard,
 * every mutation incl. cross-parent move reindex and subtree delete, reorder
 * parity with `reorderList`, preset-id preservation, import-flatten/export-
 * reassemble round-trips, and transaction atomicity (a forced mid-write failure
 * rolls back).
 */

// ==================
//  Test data builders
// ==================

/** Builds a minimal nested item. `content.id` lets us observe deep-re-ID behaviour. */
function makeItem(id: string, name: string): DrawerItem {
   return {
      id,
      game: 'LEGENDS',
      type: 'CHARACTER_CARD',
      name,
      content: { id: `content-${id}`, label: name } as unknown as DrawerItemContent,
   };
}

/** Builds a minimal nested folder. */
function makeFolder(id: string, name: string, items: DrawerItem[] = [], folders: Folder[] = []): Folder {
   return { id, name, items, folders };
}

const ITEM_CONTENT = { id: 'fixed-content', label: 'fixed' } as unknown as DrawerItemContent;

// ==================
//  Isolation
// ==================

beforeEach(async () => {
   await drawerDatabase.folders.clear();
   await drawerDatabase.items.clear();
   await drawerDatabase.meta.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

// ==================
//  Read API
// ==================

describe('read API', () => {
   it('returns child folders and items ordered by their sibling order', async () => {
      const first = await repository.createFolder({ name: 'Alpha', parentFolderId: null });
      const second = await repository.createFolder({ name: 'Bravo', parentFolderId: null });
      await repository.createItem({ name: 'Item A', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });
      await repository.createItem({ name: 'Item B', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });

      const { folders, items } = await repository.getFolderChildren(null);

      expect(folders.map((folder) => folder.id)).toEqual([first.id, second.id]);
      expect(folders.map((folder) => folder.order)).toEqual([0, 1]);
      expect(items.map((item) => item.name)).toEqual(['Item A', 'Item B']);
      expect(items.map((item) => item.order)).toEqual([0, 1]);
   });

   it('stores top-level records under the root sentinel parent id', async () => {
      const folder = await repository.createFolder({ name: 'Root folder', parentFolderId: null });
      expect(folder.parentFolderId).toBe(DRAWER_ROOT_PARENT_ID);
   });

   it('getFolder / getItem return undefined for missing ids', async () => {
      expect(await repository.getFolder('nope')).toBeUndefined();
      expect(await repository.getItem('nope')).toBeUndefined();
   });

   it('resolves a breadcrumb path root -> target by walking parents', async () => {
      const top = await repository.createFolder({ name: 'Top', parentFolderId: null });
      const middle = await repository.createFolder({ name: 'Middle', parentFolderId: top.id });
      const leaf = await repository.createFolder({ name: 'Leaf', parentFolderId: middle.id });

      const path = await repository.getBreadcrumbPath(leaf.id);
      expect(path.map((folder) => folder.name)).toEqual(['Top', 'Middle', 'Leaf']);

      expect(await repository.getBreadcrumbPath(null)).toEqual([]);
   });

   it('counts only direct children (not recursive)', async () => {
      const parent = await repository.createFolder({ name: 'Parent', parentFolderId: null });
      const child = await repository.createFolder({ name: 'Child', parentFolderId: parent.id });
      // A grandchild folder + item must NOT be counted under `parent`.
      await repository.createFolder({ name: 'Grandchild', parentFolderId: child.id });
      await repository.createItem({ name: 'Deep item', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: child.id });
      await repository.createItem({ name: 'Direct item', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: parent.id });

      const counts = await repository.getChildCounts(parent.id);
      expect(counts).toEqual({ folderCount: 1, itemCount: 1 });

      const batched = await repository.getChildCountsForFolders([parent.id, child.id]);
      expect(batched.get(parent.id)).toEqual({ folderCount: 1, itemCount: 1 });
      expect(batched.get(child.id)).toEqual({ folderCount: 1, itemCount: 1 });
   });

   it('identifies a folder as self/descendant of an ancestor', async () => {
      const grandparent = await repository.createFolder({ name: 'GP', parentFolderId: null });
      const parent = await repository.createFolder({ name: 'P', parentFolderId: grandparent.id });
      const child = await repository.createFolder({ name: 'C', parentFolderId: parent.id });
      const unrelated = await repository.createFolder({ name: 'U', parentFolderId: null });

      expect(await repository.isFolderSelfOrDescendant(grandparent.id, grandparent.id)).toBe(true); // self
      expect(await repository.isFolderSelfOrDescendant(child.id, grandparent.id)).toBe(true); // descendant
      expect(await repository.isFolderSelfOrDescendant(unrelated.id, grandparent.id)).toBe(false);
      expect(await repository.isFolderSelfOrDescendant(grandparent.id, child.id)).toBe(false); // ancestor is not descendant
   });
});

// ==================
//  Folder mutations
// ==================

describe('folder mutations', () => {
   it('appends a created folder at the end of its parent', async () => {
      await repository.createFolder({ name: 'A', parentFolderId: null });
      const second = await repository.createFolder({ name: 'B', parentFolderId: null });
      expect(second.order).toBe(1);
   });

   it('renames a folder and throws when it does not exist', async () => {
      const folder = await repository.createFolder({ name: 'Old', parentFolderId: null });
      await repository.renameFolder(folder.id, 'New');
      expect((await repository.getFolder(folder.id))?.name).toBe('New');

      await expect(repository.renameFolder('missing', 'X')).rejects.toBeInstanceOf(DrawerNotFoundError);
   });

   it('moves a folder across parents and reindexes both sides', async () => {
      const source = await repository.createFolder({ name: 'Source', parentFolderId: null });
      const destination = await repository.createFolder({ name: 'Destination', parentFolderId: null });
      const moved = await repository.createFolder({ name: 'Moved', parentFolderId: source.id });
      const staysInSource = await repository.createFolder({ name: 'Stays', parentFolderId: source.id });
      await repository.createFolder({ name: 'Existing', parentFolderId: destination.id });

      await repository.moveFolder(moved.id, destination.id);

      const sourceChildren = (await repository.getFolderChildren(source.id)).folders;
      expect(sourceChildren.map((folder) => folder.id)).toEqual([staysInSource.id]);
      expect(sourceChildren.map((folder) => folder.order)).toEqual([0]); // reindexed

      const destinationChildren = (await repository.getFolderChildren(destination.id)).folders;
      expect(destinationChildren.map((folder) => folder.name)).toEqual(['Existing', 'Moved']);
      expect(destinationChildren.map((folder) => folder.order)).toEqual([0, 1]); // appended + contiguous
   });

   it('rejects moving a folder into itself or its own descendant', async () => {
      const parent = await repository.createFolder({ name: 'Parent', parentFolderId: null });
      const child = await repository.createFolder({ name: 'Child', parentFolderId: parent.id });

      await expect(repository.moveFolder(parent.id, parent.id)).rejects.toBeInstanceOf(DrawerInvalidOperationError);
      await expect(repository.moveFolder(parent.id, child.id)).rejects.toBeInstanceOf(DrawerInvalidOperationError);
   });

   it('deletes a folder with its entire subtree and reindexes siblings', async () => {
      const doomed = await repository.createFolder({ name: 'Doomed', parentFolderId: null });
      const survivor = await repository.createFolder({ name: 'Survivor', parentFolderId: null });
      const subFolder = await repository.createFolder({ name: 'Sub', parentFolderId: doomed.id });
      await repository.createItem({ name: 'Top item', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: doomed.id });
      const deepItem = await repository.createItem({ name: 'Deep item', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: subFolder.id });

      await repository.deleteFolder(doomed.id);

      expect(await repository.getFolder(doomed.id)).toBeUndefined();
      expect(await repository.getFolder(subFolder.id)).toBeUndefined();
      expect(await repository.getItem(deepItem.id)).toBeUndefined();

      const rootFolders = (await repository.getFolderChildren(null)).folders;
      expect(rootFolders.map((folder) => folder.id)).toEqual([survivor.id]);
      expect(rootFolders.map((folder) => folder.order)).toEqual([0]); // reindexed after deletion
   });

   it('reorders folders with reorderList parity and rejects out-of-range indices', async () => {
      const created = [];
      for (const name of ['A', 'B', 'C', 'D']) {
         created.push(await repository.createFolder({ name, parentFolderId: null }));
      }
      const ids = created.map((folder) => folder.id);

      await repository.reorderFolders(null, 0, 2); // move A to index 2

      const resultIds = (await repository.getFolderChildren(null)).folders.map((folder) => folder.id);
      expect(resultIds).toEqual(reorderList(ids, 0, 2));

      await expect(repository.reorderFolders(null, 0, 99)).rejects.toBeInstanceOf(DrawerInvalidOperationError);
   });
});

// ==================
//  Item mutations
// ==================

describe('item mutations', () => {
   it('honours a preset id and otherwise generates one; stores content verbatim', async () => {
      const preset = await repository.createItem({
         id: 'preset-id',
         name: 'Preset',
         game: 'LEGENDS',
         type: 'FULL_CHARACTER_SHEET',
         content: ITEM_CONTENT,
         parentFolderId: null,
      });
      expect(preset.id).toBe('preset-id');
      // createItem does not deep-re-ID content (that is import's job): content is verbatim.
      expect((await repository.getItem('preset-id'))?.content).toStrictEqual(ITEM_CONTENT);

      const generated = await repository.createItem({ name: 'Generated', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });
      expect(generated.id).toBeTruthy();
      expect(generated.id).not.toBe('preset-id');
   });

   it('renames, updates content (preserving name unless given), and throws when missing', async () => {
      const item = await repository.createItem({ name: 'Name', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });

      await repository.renameItem(item.id, 'Renamed');
      expect((await repository.getItem(item.id))?.name).toBe('Renamed');

      const nextContent = { id: 'next', label: 'next' } as unknown as DrawerItemContent;
      await repository.updateItemContent(item.id, nextContent); // name omitted -> preserved
      let stored = await repository.getItem(item.id);
      expect(stored?.content).toStrictEqual(nextContent);
      expect(stored?.name).toBe('Renamed');

      await repository.updateItemContent(item.id, ITEM_CONTENT, 'Both'); // name provided -> updated
      stored = await repository.getItem(item.id);
      expect(stored?.name).toBe('Both');

      await expect(repository.renameItem('missing', 'X')).rejects.toBeInstanceOf(DrawerNotFoundError);
      await expect(repository.updateItemContent('missing', ITEM_CONTENT)).rejects.toBeInstanceOf(DrawerNotFoundError);
      await expect(repository.deleteItem('missing')).rejects.toBeInstanceOf(DrawerNotFoundError);
   });

   it('moves an item across parents and reindexes both sides', async () => {
      const source = await repository.createFolder({ name: 'Src', parentFolderId: null });
      const destination = await repository.createFolder({ name: 'Dst', parentFolderId: null });
      const moved = await repository.createItem({ name: 'Moved', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: source.id });
      const stays = await repository.createItem({ name: 'Stays', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: source.id });
      await repository.createItem({ name: 'Existing', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: destination.id });

      await repository.moveItem(moved.id, destination.id);

      const sourceItems = (await repository.getFolderChildren(source.id)).items;
      expect(sourceItems.map((item) => item.id)).toEqual([stays.id]);
      expect(sourceItems.map((item) => item.order)).toEqual([0]);

      const destinationItems = (await repository.getFolderChildren(destination.id)).items;
      expect(destinationItems.map((item) => item.name)).toEqual(['Existing', 'Moved']);
      expect(destinationItems.map((item) => item.order)).toEqual([0, 1]);
   });

   it('deletes an item and reindexes its siblings', async () => {
      const a = await repository.createItem({ name: 'A', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });
      const b = await repository.createItem({ name: 'B', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });
      const c = await repository.createItem({ name: 'C', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });

      await repository.deleteItem(b.id);

      const items = (await repository.getFolderChildren(null)).items;
      expect(items.map((item) => item.id)).toEqual([a.id, c.id]);
      expect(items.map((item) => item.order)).toEqual([0, 1]);
   });

   it('reorders items with reorderList parity', async () => {
      const created = [];
      for (const name of ['A', 'B', 'C', 'D', 'E']) {
         created.push(await repository.createItem({ name, game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null }));
      }
      const ids = created.map((item) => item.id);

      await repository.reorderItems(null, 3, 1); // move D to index 1

      const resultIds = (await repository.getFolderChildren(null)).items.map((item) => item.id);
      expect(resultIds).toEqual(reorderList(ids, 3, 1));
   });
});

// ==================
//  Tree / bulk operations
// ==================

describe('tree / bulk operations', () => {
   it('import-flatten then export-reassemble round-trips structure with fresh ids', async () => {
      const nested = makeFolder('orig-folder', 'Campaign', [makeItem('orig-item', 'Hero')], [
         makeFolder('orig-sub', 'NPCs', [makeItem('orig-deep', 'Villain')], []),
      ]);

      await repository.importNestedFolderAsRecords(nested, null);

      const rootFolders = (await repository.getFolderChildren(null)).folders;
      expect(rootFolders).toHaveLength(1);
      const importedFolderId = rootFolders[0].id;
      expect(importedFolderId).not.toBe('orig-folder'); // deep-re-ID'd

      const reassembled = await repository.exportFolderAsNestedTree(importedFolderId);
      expect(reassembled.name).toBe('Campaign');
      expect(reassembled.items.map((item) => item.name)).toEqual(['Hero']);
      expect(reassembled.folders.map((folder) => folder.name)).toEqual(['NPCs']);
      expect(reassembled.folders[0].items.map((item) => item.name)).toEqual(['Villain']);

      // Every id (folders, items, and content) is freshly generated by deepReId.
      expect(reassembled.items[0].id).not.toBe('orig-item');
      expect((reassembled.items[0].content as unknown as { id: string }).id).not.toBe('content-orig-item');
      expect(reassembled.folders[0].id).not.toBe('orig-sub');
      expect(reassembled.folders[0].items[0].id).not.toBe('orig-deep');
   });

   it('imports a whole drawer as a single named folder', async () => {
      const drawer = {
         folders: [makeFolder('d-sub', 'Sub', [], [])],
         rootItems: [makeItem('d-item', 'Loose')],
      };

      await repository.importDrawerAsFolder(drawer, 'Imported Drawer', null);

      const rootFolders = (await repository.getFolderChildren(null)).folders;
      expect(rootFolders.map((folder) => folder.name)).toEqual(['Imported Drawer']);

      const wrapper = await repository.exportFolderAsNestedTree(rootFolders[0].id);
      expect(wrapper.items.map((item) => item.name)).toEqual(['Loose']);
      expect(wrapper.folders.map((folder) => folder.name)).toEqual(['Sub']);
   });

   it('exports the entire drawer as a nested tree', async () => {
      const folder = await repository.createFolder({ name: 'Top', parentFolderId: null });
      await repository.createItem({ name: 'Nested', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: folder.id });
      await repository.createItem({ name: 'Root item', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });

      const drawer = await repository.exportEntireDrawerAsNestedTree();
      expect(drawer.rootItems.map((item) => item.name)).toEqual(['Root item']);
      expect(drawer.folders.map((f) => f.name)).toEqual(['Top']);
      expect(drawer.folders[0].items.map((item) => item.name)).toEqual(['Nested']);
   });

   it('exportFolderAsNestedTree throws when the folder is missing', async () => {
      await expect(repository.exportFolderAsNestedTree('missing')).rejects.toBeInstanceOf(DrawerNotFoundError);
   });

   it('clearAllDrawerData removes folders and items but preserves meta', async () => {
      await repository.createFolder({ name: 'A', parentFolderId: null });
      await repository.createItem({ name: 'I', game: 'LEGENDS', type: 'CHARACTER_CARD', content: ITEM_CONTENT, parentFolderId: null });
      await drawerDatabase.meta.put({ key: 'migrationStatus', value: 'completed' });

      await repository.clearAllDrawerData();

      const { folders, items } = await repository.getFolderChildren(null);
      expect(folders).toHaveLength(0);
      expect(items).toHaveLength(0);
      // Migration flag must survive so a retained legacy blob is not re-imported.
      expect((await drawerDatabase.meta.get('migrationStatus'))?.value).toBe('completed');
   });
});

// ==================
//  Transaction atomicity
// ==================

describe('transaction atomicity', () => {
   it('rolls back every write when a mutation fails mid-transaction', async () => {
      // importNestedFolderAsRecords writes the folder record, then the items.
      // Force the items write to fail and assert the folder write rolled back too.
      const bulkAddSpy = vi
         .spyOn(drawerDatabase.items, 'bulkAdd')
         .mockRejectedValueOnce(new Error('forced mid-transaction failure'));

      const nested = makeFolder('atomic-folder', 'Atomic', [makeItem('atomic-item', 'Item')], []);

      await expect(repository.importNestedFolderAsRecords(nested, null)).rejects.toBeInstanceOf(DrawerTransactionError);

      // Nothing committed: the folder added before the failing items write is gone.
      const { folders, items } = await repository.getFolderChildren(null);
      expect(folders).toHaveLength(0);
      expect(items).toHaveLength(0);

      bulkAddSpy.mockRestore();
   });
});
