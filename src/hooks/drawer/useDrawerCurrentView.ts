// -- React Imports --
import { useMemo, useSyncExternalStore } from 'react';

// -- Store Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Drawer Data Layer Imports --
import {
   getBreadcrumb,
   getChildFolders,
   getParentFolderId,
   getDrawerFolderTreeVersion,
   subscribeDrawerFolderTree,
} from '@/lib/drawer/drawerFolderTree';

// -- Type Imports --
import type { DrawerItemRecord } from '@/lib/drawer/drawerRecords';

// Stable empty references so a not-yet-loaded view does not hand callers a fresh
// array/map each render (which would defeat memoization downstream).
const EMPTY_ITEMS: readonly DrawerItemRecord[] = [];
const EMPTY_CHILD_COUNTS: ReadonlyMap<string, { folderCount: number; itemCount: number }> = new Map();

/**
 * Reads the current drawer folder's view. The folder STRUCTURE - child folders, breadcrumb, parent -
 * is served synchronously from the in-memory folder-tree cache (re-derived on mutation), so navigation
 * is instant with no empty frame. The ITEMS are loaded lazily by the store, so only they fall back to a
 * skeleton while a new folder's items query runs.
 *
 * This is a pure selector hook - it does not trigger loading. Items are loaded by the store's
 * `setDrawerCurrentFolderId` / `reloadCurrentFolder`; the folder cache loads/refreshes itself.
 *
 * @returns The current folder id, its ordered child `folders` (cache) and `items` (store), the
 *   per-child-folder `childCounts`, the `breadcrumbPath`, the `parentFolderId`, the `isContentLoading`
 *   flag (items only), and `isLoading` / `error`.
 */
export function useDrawerCurrentView() {
   const currentFolderId = useDrawerStore((state) => state.currentFolderId);
   const currentFolderView = useDrawerStore((state) => state.currentFolderView);
   const isLoading = useDrawerStore((state) => state.isLoading);
   const error = useDrawerStore((state) => state.error);

   // Subscribe to the folder-tree cache; the version forces a recompute of the folder structure when the
   // cache is rebuilt (on a mutation), while reads on navigation just hit the live index - no query.
   const folderTreeVersion = useSyncExternalStore(subscribeDrawerFolderTree, getDrawerFolderTreeVersion);
   const { folders, breadcrumbPath, parentFolderId } = useMemo(() => {
      // The selectors read the cache's module state, which the linter can't see; the version is the
      // change signal, so recompute (and keep stable refs) whenever it or the folder changes.
      void folderTreeVersion;
      return {
         folders: getChildFolders(currentFolderId),
         breadcrumbPath: getBreadcrumb(currentFolderId),
         parentFolderId: getParentFolderId(currentFolderId),
      };
   }, [currentFolderId, folderTreeVersion]);

   return {
      currentFolderId,
      folders,
      items: currentFolderView?.items ?? EMPTY_ITEMS,
      childCounts: currentFolderView?.childCounts ?? EMPTY_CHILD_COUNTS,
      breadcrumbPath,
      parentFolderId,
      isLoading,
      // The items view is nulled ONLY on navigation (the store clears it before loading the new folder's
      // items), so this means "navigating, items not loaded yet" - distinct from a loaded-but-empty
      // folder. It drives the ITEM skeleton; folders render from the cache regardless. A reload /
      // optimistic mutation keeps the view, so it never fires there.
      isContentLoading: currentFolderView === null,
      error,
   };
}
