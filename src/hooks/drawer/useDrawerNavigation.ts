// -- React Imports --
import { useCallback } from 'react';

// -- Store Imports --
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Hook Imports --
import { useDrawerCurrentView } from './useDrawerCurrentView';

/**
 * Owns the drawer's folder navigation and exposes the current-folder view.
 *
 * Reimplemented over the normalized store: the view (items, subfolders, breadcrumb,
 * parent, child counts) comes from the store's loaded
 * `currentFolderView` rather than being derived from an in-memory tree, and
 * `navigateToFolder` calls the async `setDrawerCurrentFolderId` (which loads the
 * target folder). The callback is fire-and-forget so click handlers stay
 * synchronous; loading/error are observable via the returned flags.
 *
 * The records are now flat `DrawerFolderRecord` / `DrawerItemRecord` (not the old
 * nested `Folder` / `DrawerItem`), and the old `currentFolderPath` id-chain is
 * gone (the parent id is supplied directly by the store).
 *
 * @returns The current folder id, the `navigateToFolder` callback, the ordered
 *   `currentItems` / `currentFolders`, `parentFolderId`, `breadcrumbPath`,
 *   per-child `childCounts`, and `isLoading` / `error`.
 */
export function useDrawerNavigation() {
   const view = useDrawerCurrentView();
   const { setDrawerCurrentFolderId } = useDrawerActions();

   const navigateToFolder = useCallback(
      (id: string | null) => {
         // Fire-and-forget: the store sets the id and loads the folder; callers
         // (click handlers) do not need to await.
         void setDrawerCurrentFolderId(id);
      },
      [setDrawerCurrentFolderId],
   );

   return {
      currentFolderId: view.currentFolderId,
      navigateToFolder,
      currentItems: view.items,
      currentFolders: view.folders,
      parentFolderId: view.parentFolderId,
      breadcrumbPath: view.breadcrumbPath,
      childCounts: view.childCounts,
      isLoading: view.isLoading,
      error: view.error,
   };
}
