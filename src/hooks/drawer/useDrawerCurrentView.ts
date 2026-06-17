// -- Store Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';

// Stable empty references so a not-yet-loaded view does not hand callers a fresh
// array/map each render (which would defeat memoization downstream).
const EMPTY_FOLDERS: readonly DrawerFolderRecord[] = [];
const EMPTY_ITEMS: readonly DrawerItemRecord[] = [];
const EMPTY_CHILD_COUNTS: ReadonlyMap<string, { folderCount: number; itemCount: number }> = new Map();

/**
 * Reads the loaded view of the current drawer folder from the store (migration
 * spec §3.3). Selects each field individually so a component re-renders only when
 * the value it uses actually changes, and falls back to stable empty references
 * before the first load completes.
 *
 * This is a pure selector hook - it does not trigger loading. The current-folder
 * view is loaded by the store's `setDrawerCurrentFolderId` / `reloadCurrentFolder`
 * actions; a mounting surface must trigger an initial load (Phase 6 wiring).
 *
 * @returns The current folder id, its ordered child `folders` and `items`, the
 *   per-child-folder `childCounts`, the `breadcrumbPath`, the `parentFolderId`,
 *   and the `isLoading` / `error` flags.
 */
export function useDrawerCurrentView() {
   const currentFolderId = useDrawerStore((state) => state.currentFolderId);
   const currentFolderView = useDrawerStore((state) => state.currentFolderView);
   const breadcrumbPath = useDrawerStore((state) => state.breadcrumbPath);
   const parentFolderId = useDrawerStore((state) => state.parentFolderId);
   const isLoading = useDrawerStore((state) => state.isLoading);
   const error = useDrawerStore((state) => state.error);

   return {
      currentFolderId,
      folders: currentFolderView?.folders ?? EMPTY_FOLDERS,
      items: currentFolderView?.items ?? EMPTY_ITEMS,
      childCounts: currentFolderView?.childCounts ?? EMPTY_CHILD_COUNTS,
      breadcrumbPath,
      parentFolderId,
      isLoading,
      error,
   };
}
