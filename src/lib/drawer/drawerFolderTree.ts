// -- Drawer Data Layer Imports --
import { getAllFolders } from './drawerRepository';
import { drawerCommandEngine } from './drawerCommandEngine';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';

// -- Type Imports --
import type { DrawerFolderRecord } from './drawerRecords';

/*
 * In-memory cache of the drawer's FOLDER structure, so navigation is instant - the folder list,
 * breadcrumb, and parent of any folder are O(1)/O(depth) reads from memory, with no per-navigation
 * query. Item CONTENTS stay lazy (the item area keeps its own loader).
 *
 * The one rule that makes this safe: RE-DERIVE, never replicate. Memory is not the source of truth -
 * the DB is. On ANY drawer mutation the cache is thrown away and rebuilt from a single getAllFolders
 * read; it is NEVER patched with a delta. Folders are tiny and mutations are rare next to navigation,
 * so a full rebuild is cheap and cannot drift. The trigger is ONE command-engine subscription (the
 * same pattern useDrawerItemContent uses for its content version); navigation reads the cache and
 * never re-derives.
 *
 * The structure is flat: a record map plus a precomputed children index (by parent, ordered). "Children
 * of X" is one map lookup; the breadcrumb is a parent-chain walk. No nested objects, no recursion.
 */

/** The flat folder index: every record by id, plus children ordered under each stored parent id. */
export interface DrawerFolderTreeIndex {
   foldersById: Map<string, DrawerFolderRecord>;
   /** Keyed by STORED parent id ({@link DRAWER_ROOT_PARENT_ID} for root); each list sorted by `order`. */
   childrenByParent: Map<string, DrawerFolderRecord[]>;
}

const EMPTY_FOLDERS: readonly DrawerFolderRecord[] = [];

/** Maps the app's `string | null` parent (null = root) to the stored sentinel form. */
function toStoredParentId(parentFolderId: string | null): string {
   return parentFolderId ?? DRAWER_ROOT_PARENT_ID;
}

// ==================
//  Pure builder + selectors (no module state, so they unit-test directly)
// ==================

/** Builds both maps from a flat record list, sorting each sibling set by `order`. */
export function buildFolderTreeIndex(records: DrawerFolderRecord[]): DrawerFolderTreeIndex {
   const foldersById = new Map<string, DrawerFolderRecord>();
   const childrenByParent = new Map<string, DrawerFolderRecord[]>();

   for (const record of records) {
      foldersById.set(record.id, record);
      const siblings = childrenByParent.get(record.parentFolderId);
      if (siblings) siblings.push(record);
      else childrenByParent.set(record.parentFolderId, [record]);
   }
   for (const siblings of childrenByParent.values()) {
      siblings.sort((a, b) => a.order - b.order);
   }
   return { foldersById, childrenByParent };
}

/** Ordered child folders of a parent (`null` = root) - one O(1) index lookup. */
export function selectChildFolders(index: DrawerFolderTreeIndex, parentId: string | null): readonly DrawerFolderRecord[] {
   return index.childrenByParent.get(toStoredParentId(parentId)) ?? EMPTY_FOLDERS;
}

/**
 * Breadcrumb from the root down to `folderId` (`null` = root -> `[]`), by walking the parent chain.
 * A `visited` guard means an accidental cycle stops instead of looping forever.
 */
export function selectBreadcrumb(index: DrawerFolderTreeIndex, folderId: string | null): DrawerFolderRecord[] {
   if (folderId === null) return [];
   const path: DrawerFolderRecord[] = [];
   const visited = new Set<string>();
   let cursor: string | null = folderId;
   while (cursor !== null && cursor !== DRAWER_ROOT_PARENT_ID) {
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const folder = index.foldersById.get(cursor);
      if (!folder) break;
      path.unshift(folder);
      cursor = folder.parentFolderId;
   }
   return path;
}

/** The parent of a folder as `string | null` (null = a top-level folder, or an unknown/root id). */
export function selectParentFolderId(index: DrawerFolderTreeIndex, folderId: string | null): string | null {
   if (folderId === null) return null;
   const folder = index.foldersById.get(folderId);
   if (!folder || folder.parentFolderId === DRAWER_ROOT_PARENT_ID) return null;
   return folder.parentFolderId;
}

// ==================
//  Module cache (re-derived on mutation, read on navigation)
// ==================

let index: DrawerFolderTreeIndex = buildFolderTreeIndex([]);
let version = 0;
const listeners = new Set<() => void>();
let currentRebuild: Promise<void> = Promise.resolve();

/** Re-reads every folder and rebuilds the index from scratch, then bumps the version. */
async function rebuild(): Promise<void> {
   const records = await getAllFolders();
   index = buildFolderTreeIndex(records);
   version += 1;
   for (const listener of listeners) listener();
}

/** Throws the cache away and rebuilds it from the DB. The mutation trigger; returns the in-flight rebuild. */
export function rebuildFolderTree(): Promise<void> {
   currentRebuild = rebuild();
   return currentRebuild;
}

/** Resolves once the latest rebuild has settled - so a read right after a mutation sees fresh folders. */
export function whenFolderTreeSettled(): Promise<void> {
   return currentRebuild;
}

// ONE subscription: re-derive on every drawer mutation (execute / undo / redo), never patch in place.
drawerCommandEngine.subscribe(() => {
   void rebuildFolderTree();
});
// Initial load, so the cache is warm before the drawer is opened.
void rebuildFolderTree();

/** Subscribes to the folder-tree version (bumped on every rebuild); returns an unsubscribe. */
export function subscribeDrawerFolderTree(listener: () => void): () => void {
   listeners.add(listener);
   return () => {
      listeners.delete(listener);
   };
}

/** The current folder-tree version (changes whenever the cache is rebuilt). */
export function getDrawerFolderTreeVersion(): number {
   return version;
}

/** Ordered child folders of a parent (`null` = root), from the live cache. */
export function getChildFolders(parentId: string | null): readonly DrawerFolderRecord[] {
   return selectChildFolders(index, parentId);
}

/** Direct child-folder count of a parent (`null` = root), from the live cache. */
export function getChildFolderCount(parentId: string | null): number {
   return selectChildFolders(index, parentId).length;
}

/** Breadcrumb from root down to `folderId`, from the live cache. */
export function getBreadcrumb(folderId: string | null): DrawerFolderRecord[] {
   return selectBreadcrumb(index, folderId);
}

/** The parent of `folderId` as `string | null`, from the live cache. */
export function getParentFolderId(folderId: string | null): string | null {
   return selectParentFolderId(index, folderId);
}
