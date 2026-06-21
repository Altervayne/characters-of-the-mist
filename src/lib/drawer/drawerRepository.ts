// -- Library Imports --
import { Dexie, type Table } from 'dexie';
import cuid from 'cuid';

// -- Utils Imports --
import { deepReId, reorderList } from '@/lib/utils/drawer';

// -- Local Imports --
import { drawerDatabase as db } from './drawerDatabase';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';
import { DrawerInvalidOperationError, DrawerNotFoundError, DrawerTransactionError } from './drawerErrors';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord } from './drawerRecords';
import type { Drawer, DrawerItem, DrawerItemContent, Folder, GameSystem, GeneralItemType } from '@/lib/types/drawer';

/*
 * Framework-agnostic data-access layer for the normalized drawer. Pure persistence:
 * no React, no zustand, no toasts, no console. Every
 * mutation runs in a single Dexie `rw` transaction so multi-row operations
 * (move, delete-subtree, reorder, import) are atomic. Reads that must be
 * internally consistent run in a single `r` transaction. Errors are thrown as the
 * typed errors in `drawerErrors.ts`; the store layer is the only place that turns
 * them into UI.
 *
 * Ordering: each sibling set (children sharing a `parentFolderId`,
 * separately for folders and items) holds a contiguous integer `order` of
 * `0..n-1`. Inserts append; moves/deletes/reorders reindex the affected sibling
 * set within the transaction.
 */

// ==================
//  Parent-id translation (sentinel <-> null)
// ==================

/**
 * Maps the application's `string | null` parent (where `null` means root) to the
 * stored form, substituting {@link DRAWER_ROOT_PARENT_ID} for `null` so root
 * rows remain visible to the parent/order indexes.
 */
function toStoredParentId(parentFolderId: string | null): string {
   return parentFolderId ?? DRAWER_ROOT_PARENT_ID;
}

// ==================
//  Transaction wrappers
// ==================

/**
 * Runs `work` in a read/write transaction over `tables`. Domain errors
 * ({@link DrawerNotFoundError}, {@link DrawerInvalidOperationError}) propagate
 * unchanged so callers can branch on them; any other failure aborts the
 * transaction (rolling back every write) and is rethrown as a
 * {@link DrawerTransactionError} that preserves the original cause.
 */
async function runWriteTransaction<T>(tables: Table[], work: () => Promise<T>): Promise<T> {
   try {
      return await db.transaction('rw', tables, work);
   } catch (error) {
      if (error instanceof DrawerNotFoundError || error instanceof DrawerInvalidOperationError) {
         throw error;
      }
      throw new DrawerTransactionError(
         `Drawer write transaction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
         { cause: error },
      );
   }
}

/**
 * Runs `work` in a read-only transaction over `tables`, with the same error
 * translation as {@link runWriteTransaction}.
 */
async function runReadTransaction<T>(tables: Table[], work: () => Promise<T>): Promise<T> {
   try {
      return await db.transaction('r', tables, work);
   } catch (error) {
      if (error instanceof DrawerNotFoundError || error instanceof DrawerInvalidOperationError) {
         throw error;
      }
      throw new DrawerTransactionError(
         `Drawer read transaction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
         { cause: error },
      );
   }
}

// ==================
//  Internal helpers (must run inside an active transaction)
// ==================

/** Loads a folder by id within the active transaction, throwing if absent. */
async function requireFolder(folderId: string): Promise<DrawerFolderRecord> {
   const folder = await db.folders.get(folderId);
   if (!folder) throw new DrawerNotFoundError(`Drawer folder not found: ${folderId}`);
   return folder;
}

/** Loads an item by id within the active transaction, throwing if absent. */
async function requireItem(itemId: string): Promise<DrawerItemRecord> {
   const item = await db.items.get(itemId);
   if (!item) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
   return item;
}

/** Ordered child folders of a stored parent id, via the `[parentFolderId+order]` index. */
function orderedChildFolders(storedParentId: string): Promise<DrawerFolderRecord[]> {
   return db.folders
      .where('[parentFolderId+order]')
      .between([storedParentId, Dexie.minKey], [storedParentId, Dexie.maxKey])
      .toArray();
}

/** Ordered child items of a stored parent id, via the `[parentFolderId+order]` index. */
function orderedChildItems(storedParentId: string): Promise<DrawerItemRecord[]> {
   return db.items
      .where('[parentFolderId+order]')
      .between([storedParentId, Dexie.minKey], [storedParentId, Dexie.maxKey])
      .toArray();
}

/** Reassigns contiguous `0..n-1` order to the folder sibling set of a stored parent. */
async function reindexFolderSiblings(storedParentId: string): Promise<void> {
   const siblings = await orderedChildFolders(storedParentId);
   if (siblings.length === 0) return;
   await db.folders.bulkPut(siblings.map((folder, index) => ({ ...folder, order: index })));
}

/** Reassigns contiguous `0..n-1` order to the item sibling set of a stored parent. */
async function reindexItemSiblings(storedParentId: string): Promise<void> {
   const siblings = await orderedChildItems(storedParentId);
   if (siblings.length === 0) return;
   await db.items.bulkPut(siblings.map((item, index) => ({ ...item, order: index })));
}

/**
 * Whether `candidateFolderId` is `ancestorFolderId` itself or one of its
 * descendants, by walking the parent chain upward from the candidate. Runs inside
 * the active transaction; a `visited` guard prevents an accidental cycle from
 * looping forever.
 */
async function isSelfOrDescendantWithinTransaction(candidateFolderId: string, ancestorFolderId: string): Promise<boolean> {
   const visited = new Set<string>();
   let cursorFolderId = candidateFolderId;

   while (cursorFolderId !== DRAWER_ROOT_PARENT_ID) {
      if (cursorFolderId === ancestorFolderId) return true;
      if (visited.has(cursorFolderId)) break;
      visited.add(cursorFolderId);

      const folder: DrawerFolderRecord | undefined = await db.folders.get(cursorFolderId);
      if (!folder) break;
      cursorFolderId = folder.parentFolderId;
   }

   return false;
}

/** Collects the id of a folder and every folder beneath it (breadth-first). */
async function collectSubtreeFolderIds(rootFolderId: string): Promise<string[]> {
   const collected: string[] = [];
   const visited = new Set<string>();
   const queue: string[] = [rootFolderId];

   while (queue.length > 0) {
      const folderId = queue.shift()!;
      if (visited.has(folderId)) continue;
      visited.add(folderId);
      collected.push(folderId);

      const childIds = (await db.folders.where('parentFolderId').equals(folderId).primaryKeys()) as string[];
      queue.push(...childIds);
   }

   return collected;
}

/**
 * Writes one (already deep-re-ID'd) nested folder and its whole subtree as flat
 * records, depth-first. The folder record is written *before* its items so a
 * mid-write failure in the items leaves nothing partially committed (the
 * transaction rolls the folder back too).
 */
async function writeFolderSubtree(folder: Folder, storedParentId: string, order: number): Promise<void> {
   await db.folders.add({ id: folder.id, name: folder.name, parentFolderId: storedParentId, order });

   if (folder.items.length > 0) {
      await db.items.bulkAdd(
         folder.items.map((item, index) => ({
            id: item.id,
            name: item.name,
            parentFolderId: folder.id,
            order: index,
            game: item.game,
            type: item.type,
            content: item.content,
         })),
      );
   }

   for (let index = 0; index < folder.folders.length; index += 1) {
      await writeFolderSubtree(folder.folders[index], folder.id, index);
   }
}

/** Maps a stored item record back to the nested {@link DrawerItem} export shape. */
function toNestedItem(record: DrawerItemRecord): DrawerItem {
   return { id: record.id, game: record.game, type: record.type, name: record.name, content: record.content };
}

/**
 * Reassembles a folder record and its subtree into the nested {@link Folder}
 * shape, ordered by `order`. Runs inside the active read transaction.
 */
async function buildNestedFolder(folderRecord: DrawerFolderRecord): Promise<Folder> {
   const items = (await orderedChildItems(folderRecord.id)).map(toNestedItem);
   const childFolderRecords = await orderedChildFolders(folderRecord.id);

   const folders: Folder[] = [];
   for (const childFolderRecord of childFolderRecords) {
      folders.push(await buildNestedFolder(childFolderRecord));
   }

   return { id: folderRecord.id, name: folderRecord.name, items, folders };
}

/** Throws if `index` is outside `[0, length)` (a reorder would otherwise corrupt order). */
function assertIndexInRange(index: number, length: number, label: string): void {
   if (!Number.isInteger(index) || index < 0 || index >= length) {
      throw new DrawerInvalidOperationError(`Reorder ${label} index ${index} is out of range [0, ${length}).`);
   }
}

/**
 * Throws unless `provided` is a permutation of `current` (same size, same members).
 * Guards the explicit-order writers so a stale/incomplete id list cannot leave a
 * sibling set with gaps or duplicates.
 */
function assertSamePermutation(current: string[], provided: string[], label: string): void {
   const currentSet = new Set(current);
   const sameSize = current.length === provided.length;
   const sameMembers = provided.every((id) => currentSet.has(id));
   if (!sameSize || !sameMembers) {
      throw new DrawerInvalidOperationError(`Explicit ${label} order is not a permutation of the current sibling set.`);
   }
}

// ==================
//  Read API
// ==================

/**
 * Ordered children of a folder. `parentFolderId === null` reads the drawer root.
 * Folders and items are each returned sorted ascending by their sibling `order`.
 */
export function getFolderChildren(
   parentFolderId: string | null,
): Promise<{ folders: DrawerFolderRecord[]; items: DrawerItemRecord[] }> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runReadTransaction([db.folders, db.items], async () => ({
      folders: await orderedChildFolders(storedParentId),
      items: await orderedChildItems(storedParentId),
   }));
}

/** Loads a single folder record by id, or `undefined` if it does not exist. */
export function getFolder(folderId: string): Promise<DrawerFolderRecord | undefined> {
   return db.folders.get(folderId);
}

/** Loads a single item record by id, or `undefined` if it does not exist. */
export function getItem(itemId: string): Promise<DrawerItemRecord | undefined> {
   return db.items.get(itemId);
}

/**
 * Every stored item's `content`, across all folders. Used by the asset garbage
 * collector to scan drawer-held cards and characters for asset references; returns
 * the contents only (the GC has no use for placement metadata).
 */
export async function listAllItemContents(): Promise<DrawerItemContent[]> {
   const items = await db.items.toArray();
   return items.map((item) => item.content);
}

/**
 * The breadcrumb trail from the drawer root down to `folderId`, by walking the
 * parent chain. Returns `[]` for the root (`null`). If the chain references a
 * missing folder the walk stops and returns what it has resolved; a `visited`
 * guard prevents an accidental cycle from looping forever.
 */
export function getBreadcrumbPath(folderId: string | null): Promise<DrawerFolderRecord[]> {
   if (folderId === null) return Promise.resolve([]);

   return runReadTransaction([db.folders], async () => {
      const path: DrawerFolderRecord[] = [];
      const visited = new Set<string>();
      let cursorFolderId: string | null = folderId;

      while (cursorFolderId !== null) {
         if (visited.has(cursorFolderId)) break;
         visited.add(cursorFolderId);

         const folder: DrawerFolderRecord | undefined = await db.folders.get(cursorFolderId);
         if (!folder) break;
         path.unshift(folder);
         cursorFolderId = folder.parentFolderId === DRAWER_ROOT_PARENT_ID ? null : folder.parentFolderId;
      }

      return path;
   });
}

/**
 * Direct child counts for a folder (`null` = root). Counts immediate children
 * only - it is deliberately not recursive, matching today's
 * `folder.folders.length` / `folder.items.length`.
 */
export function getChildCounts(parentFolderId: string | null): Promise<{ folderCount: number; itemCount: number }> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runReadTransaction([db.folders, db.items], async () => ({
      folderCount: await db.folders.where('parentFolderId').equals(storedParentId).count(),
      itemCount: await db.items.where('parentFolderId').equals(storedParentId).count(),
   }));
}

/**
 * Direct child counts for many folders at once, keyed by folder id - the batched
 * form used when rendering a list of folder rows (avoids an N+1 of single-count
 * calls). Counts are direct children only, not recursive.
 */
export function getChildCountsForFolders(
   folderIds: string[],
): Promise<Map<string, { folderCount: number; itemCount: number }>> {
   return runReadTransaction([db.folders, db.items], async () => {
      const counts = new Map<string, { folderCount: number; itemCount: number }>();
      for (const folderId of folderIds) {
         counts.set(folderId, {
            folderCount: await db.folders.where('parentFolderId').equals(folderId).count(),
            itemCount: await db.items.where('parentFolderId').equals(folderId).count(),
         });
      }
      return counts;
   });
}

/**
 * Whether `candidateFolderId` is the same as, or a descendant of,
 * `potentialAncestorFolderId`. Backs the "move into self/own-subtree" guard in
 * the move pickers.
 */
export function isFolderSelfOrDescendant(candidateFolderId: string, potentialAncestorFolderId: string): Promise<boolean> {
   return runReadTransaction([db.folders], () =>
      isSelfOrDescendantWithinTransaction(candidateFolderId, potentialAncestorFolderId),
   );
}

// ==================
//  Folder mutations
// ==================

/** Creates an empty folder appended to the end of its parent (`null` = root). */
export function createFolder(input: { name: string; parentFolderId: string | null }): Promise<DrawerFolderRecord> {
   const storedParentId = toStoredParentId(input.parentFolderId);
   return runWriteTransaction([db.folders], async () => {
      const order = await db.folders.where('parentFolderId').equals(storedParentId).count();
      const record: DrawerFolderRecord = { id: cuid(), name: input.name, parentFolderId: storedParentId, order };
      await db.folders.add(record);
      return record;
   });
}

/** Renames a folder. Throws {@link DrawerNotFoundError} if it does not exist. */
export function renameFolder(folderId: string, newName: string): Promise<void> {
   return runWriteTransaction([db.folders], async () => {
      const updated = await db.folders.update(folderId, { name: newName });
      if (updated === 0) throw new DrawerNotFoundError(`Drawer folder not found: ${folderId}`);
   });
}

/**
 * Moves a folder under a new parent (`null` = root), appending it to the
 * destination and reindexing both the source and destination sibling sets.
 * Rejects with {@link DrawerInvalidOperationError} if the destination is the
 * folder itself or one of its descendants (which would create a cycle).
 */
export function moveFolder(folderId: string, destinationParentFolderId: string | null): Promise<void> {
   const destinationStored = toStoredParentId(destinationParentFolderId);
   return runWriteTransaction([db.folders], async () => {
      const folder = await requireFolder(folderId);
      const sourceStored = folder.parentFolderId;

      if (destinationStored !== DRAWER_ROOT_PARENT_ID && await isSelfOrDescendantWithinTransaction(destinationStored, folderId)) {
         throw new DrawerInvalidOperationError(`Cannot move folder ${folderId} into itself or its own descendant.`);
      }

      // Park the moved folder at the end of the destination (MAX order sorts last),
      // then reindex so it lands contiguously after its new siblings.
      await db.folders.update(folderId, { parentFolderId: destinationStored, order: Number.MAX_SAFE_INTEGER });
      await reindexFolderSiblings(sourceStored);
      if (destinationStored !== sourceStored) await reindexFolderSiblings(destinationStored);
   });
}

/**
 * Deletes a folder and its entire subtree (all descendant folders and every item
 * within any of them) atomically, then reindexes the source sibling set. Throws
 * {@link DrawerNotFoundError} if the folder does not exist.
 */
export function deleteFolder(folderId: string): Promise<void> {
   return runWriteTransaction([db.folders, db.items], async () => {
      const folder = await requireFolder(folderId);
      const subtreeFolderIds = await collectSubtreeFolderIds(folderId);

      await db.items.where('parentFolderId').anyOf(subtreeFolderIds).delete();
      await db.folders.where('id').anyOf(subtreeFolderIds).delete();
      await reindexFolderSiblings(folder.parentFolderId);
   });
}

/**
 * Reorders child folders within a parent (`null` = root), moving the folder at
 * `oldIndex` to `newIndex` with the exact array-move semantics of `reorderList`,
 * then writing back contiguous order. Throws {@link DrawerInvalidOperationError}
 * if either index is out of range.
 */
export function reorderFolders(parentFolderId: string | null, oldIndex: number, newIndex: number): Promise<void> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runWriteTransaction([db.folders], async () => {
      const siblings = await orderedChildFolders(storedParentId);
      assertIndexInRange(oldIndex, siblings.length, 'folder (oldIndex)');
      assertIndexInRange(newIndex, siblings.length, 'folder (newIndex)');

      const reordered = reorderList(siblings, oldIndex, newIndex);
      await db.folders.bulkPut(reordered.map((folder, index) => ({ ...folder, order: index })));
   });
}

// ==================
//  Item mutations
// ==================

/**
 * Creates an item appended to the end of its parent (`null` = root). The
 * caller-supplied `id` is honoured when present (preset-id support, e.g. linking
 * a loaded character to its drawer item); otherwise a fresh id is generated. The
 * `content` is persisted verbatim - id-regeneration for duplication is the
 * import operations' concern, not create's.
 */
export function createItem(input: {
   id?: string;
   name: string;
   game: GameSystem;
   type: GeneralItemType;
   content: DrawerItemContent;
   parentFolderId: string | null;
}): Promise<DrawerItemRecord> {
   const storedParentId = toStoredParentId(input.parentFolderId);
   return runWriteTransaction([db.items], async () => {
      const order = await db.items.where('parentFolderId').equals(storedParentId).count();
      const record: DrawerItemRecord = {
         id: input.id ?? cuid(),
         name: input.name,
         parentFolderId: storedParentId,
         order,
         game: input.game,
         type: input.type,
         content: input.content,
      };
      await db.items.add(record);
      return record;
   });
}

/** Renames an item. Throws {@link DrawerNotFoundError} if it does not exist. */
export function renameItem(itemId: string, newName: string): Promise<void> {
   return runWriteTransaction([db.items], async () => {
      const updated = await db.items.update(itemId, { name: newName });
      if (updated === 0) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
   });
}

/**
 * Moves an item under a new parent (`null` = root), appending it to the
 * destination and reindexing both the source and destination sibling sets. Throws
 * {@link DrawerNotFoundError} if the item does not exist.
 */
export function moveItem(itemId: string, destinationParentFolderId: string | null): Promise<void> {
   const destinationStored = toStoredParentId(destinationParentFolderId);
   return runWriteTransaction([db.items], async () => {
      const item = await requireItem(itemId);
      const sourceStored = item.parentFolderId;

      await db.items.update(itemId, { parentFolderId: destinationStored, order: Number.MAX_SAFE_INTEGER });
      await reindexItemSiblings(sourceStored);
      if (destinationStored !== sourceStored) await reindexItemSiblings(destinationStored);
   });
}

/** Deletes an item, then reindexes its source sibling set. Throws {@link DrawerNotFoundError} if absent. */
export function deleteItem(itemId: string): Promise<void> {
   return runWriteTransaction([db.items], async () => {
      const item = await requireItem(itemId);
      await db.items.delete(itemId);
      await reindexItemSiblings(item.parentFolderId);
   });
}

/**
 * Replaces an item's `content`, optionally also its `name` (omitting `name`
 * leaves the existing name untouched, matching today's `updateItem`). Throws
 * {@link DrawerNotFoundError} if the item does not exist.
 */
export function updateItemContent(itemId: string, content: DrawerItemContent, name?: string): Promise<void> {
   return runWriteTransaction([db.items], async () => {
      const changes = name === undefined ? { content } : { content, name };
      const updated = await db.items.update(itemId, changes);
      if (updated === 0) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
   });
}

/**
 * Reorders child items within a parent (`null` = root), moving the item at
 * `oldIndex` to `newIndex` with the exact array-move semantics of `reorderList`,
 * then writing back contiguous order. Throws {@link DrawerInvalidOperationError}
 * if either index is out of range.
 */
export function reorderItems(parentFolderId: string | null, oldIndex: number, newIndex: number): Promise<void> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runWriteTransaction([db.items], async () => {
      const siblings = await orderedChildItems(storedParentId);
      assertIndexInRange(oldIndex, siblings.length, 'item (oldIndex)');
      assertIndexInRange(newIndex, siblings.length, 'item (newIndex)');

      const reordered = reorderList(siblings, oldIndex, newIndex);
      await db.items.bulkPut(reordered.map((item, index) => ({ ...item, order: index })));
   });
}

// ==================
//  Tree / bulk operations
// ==================

/**
 * Flattens a nested {@link Folder} into records beneath `parentFolderId`
 * (`null` = root), appended after the destination's existing folders. The folder
 * is deep-re-ID'd first (fresh ids throughout) so importing a copy never collides
 * with existing rows - matching today's `addImportedFolder`.
 *
 * @returns The created top-level folder record (with its fresh id), so callers
 *   such as the undo command layer can later target the created subtree.
 */
export function importNestedFolderAsRecords(folder: Folder, parentFolderId: string | null): Promise<DrawerFolderRecord> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runWriteTransaction([db.folders, db.items], async () => {
      const freshFolder = deepReId(folder);
      const appendOrder = await db.folders.where('parentFolderId').equals(storedParentId).count();
      await writeFolderSubtree(freshFolder, storedParentId, appendOrder);
      return { id: freshFolder.id, name: freshFolder.name, parentFolderId: storedParentId, order: appendOrder };
   });
}

/**
 * Imports a whole {@link Drawer} as a single new folder named `folderName`
 * beneath `parentFolderId` (`null` = root), with the drawer's root items and
 * folders nested inside it. Everything is deep-re-ID'd - matching today's
 * `importDrawerAsFolder`.
 *
 * @returns The created wrapper folder record (with its fresh id), so the undo
 *   command layer can later target the created subtree.
 */
export function importDrawerAsFolder(
   drawer: Drawer,
   folderName: string,
   parentFolderId: string | null = null,
): Promise<DrawerFolderRecord> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runWriteTransaction([db.folders, db.items], async () => {
      const syntheticFolder: Folder = {
         id: cuid(),
         name: folderName,
         items: drawer.rootItems,
         folders: drawer.folders,
      };
      const freshFolder = deepReId(syntheticFolder);
      const appendOrder = await db.folders.where('parentFolderId').equals(storedParentId).count();
      await writeFolderSubtree(freshFolder, storedParentId, appendOrder);
      return { id: freshFolder.id, name: freshFolder.name, parentFolderId: storedParentId, order: appendOrder };
   });
}

/**
 * Reassembles a folder and its entire subtree back into the nested {@link Folder}
 * shape (for export). Throws {@link DrawerNotFoundError} if the folder does not
 * exist.
 */
export function exportFolderAsNestedTree(folderId: string): Promise<Folder> {
   return runReadTransaction([db.folders, db.items], async () => {
      const folder = await requireFolder(folderId);
      return buildNestedFolder(folder);
   });
}

/** Reassembles the entire drawer back into the nested {@link Drawer} shape (for full export). */
export function exportEntireDrawerAsNestedTree(): Promise<Drawer> {
   return runReadTransaction([db.folders, db.items], async () => {
      const rootItems = (await orderedChildItems(DRAWER_ROOT_PARENT_ID)).map(toNestedItem);
      const rootFolderRecords = await orderedChildFolders(DRAWER_ROOT_PARENT_ID);

      const folders: Folder[] = [];
      for (const rootFolderRecord of rootFolderRecords) {
         folders.push(await buildNestedFolder(rootFolderRecord));
      }

      return { folders, rootItems };
   });
}

/**
 * Deletes all folders and items (powers "Delete drawer" / "Reset app"). The
 * `meta` store is deliberately preserved: clearing the migration flag would let a
 * retained legacy localStorage blob be re-imported on the next load, silently
 * resurrecting the drawer the user just deleted.
 */
export function clearAllDrawerData(): Promise<void> {
   return runWriteTransaction([db.folders, db.items], async () => {
      await db.folders.clear();
      await db.items.clear();
   });
}

// ==================
//  Undo-support operations
// ==================
// These back the command/undo engine: restoring deleted records verbatim and
// re-applying an explicit sibling order. They are additive - the forward
// mutations above are unchanged - and exist because reverting a delete, a move,
// or a (coalesced) reorder requires restoring exact prior ids/ordering, which the
// index-based forward mutations cannot express.

/**
 * Re-inserts previously-captured records verbatim (preserving their ids, parents,
 * and order), in one transaction. Used to undo a delete and to redo a create/
 * import without regenerating ids. Adds (not puts) - the records are expected to
 * be absent (just deleted/undone); a collision is a programming error and throws.
 */
export function restoreRecords(
   folderRecords: DrawerFolderRecord[],
   itemRecords: DrawerItemRecord[],
): Promise<void> {
   return runWriteTransaction([db.folders, db.items], async () => {
      if (folderRecords.length > 0) await db.folders.bulkAdd(folderRecords);
      if (itemRecords.length > 0) await db.items.bulkAdd(itemRecords);
   });
}

/**
 * Sets the order of a folder's children to the given id sequence (`order` =
 * index), in one transaction. `orderedFolderIds` must be a permutation of the
 * current child set. Backs reorder/move/delete undo, where an exact prior order
 * must be restored.
 */
export function applyFolderOrder(parentFolderId: string | null, orderedFolderIds: string[]): Promise<void> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runWriteTransaction([db.folders], async () => {
      const siblings = await orderedChildFolders(storedParentId);
      assertSamePermutation(siblings.map((folder) => folder.id), orderedFolderIds, 'folder');
      const orderById = new Map(orderedFolderIds.map((id, index) => [id, index]));
      await db.folders.bulkPut(siblings.map((folder) => ({ ...folder, order: orderById.get(folder.id)! })));
   });
}

/**
 * Sets the order of a folder's child items to the given id sequence (`order` =
 * index), in one transaction. `orderedItemIds` must be a permutation of the
 * current child set. Backs reorder/move/delete undo for items.
 */
export function applyItemOrder(parentFolderId: string | null, orderedItemIds: string[]): Promise<void> {
   const storedParentId = toStoredParentId(parentFolderId);
   return runWriteTransaction([db.items], async () => {
      const siblings = await orderedChildItems(storedParentId);
      assertSamePermutation(siblings.map((item) => item.id), orderedItemIds, 'item');
      const orderById = new Map(orderedItemIds.map((id, index) => [id, index]));
      await db.items.bulkPut(siblings.map((item) => ({ ...item, order: orderById.get(item.id)! })));
   });
}

/**
 * Reads a folder and its entire subtree as flat records (folders + items),
 * verbatim, in one read transaction. Captured before a delete so the exact
 * records can be restored on undo, and after an import so the created subtree can
 * be restored on redo. Throws {@link DrawerNotFoundError} if the folder is absent.
 */
export function getFolderSubtreeRecords(
   folderId: string,
): Promise<{ folderRecords: DrawerFolderRecord[]; itemRecords: DrawerItemRecord[] }> {
   return runReadTransaction([db.folders, db.items], async () => {
      const rootFolder = await requireFolder(folderId);
      const folderRecords: DrawerFolderRecord[] = [];
      const itemRecords: DrawerItemRecord[] = [];

      const collect = async (folder: DrawerFolderRecord): Promise<void> => {
         folderRecords.push(folder);
         itemRecords.push(...(await db.items.where('parentFolderId').equals(folder.id).toArray()));
         const childFolders = await db.folders.where('parentFolderId').equals(folder.id).toArray();
         for (const childFolder of childFolders) {
            await collect(childFolder);
         }
      };

      await collect(rootFolder);
      return { folderRecords, itemRecords };
   });
}
