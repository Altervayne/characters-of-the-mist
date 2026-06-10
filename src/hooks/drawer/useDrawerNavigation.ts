// -- React Imports --
import { useState, useMemo } from 'react';

// -- Store Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { buildBreadcrumb, buildFolderPathIds, getParentFromPath, findFolderMemoized } from '@/lib/utils/drawer';



/**
 * Owns the Drawer's folder navigation and the view derived from the current
 * folder.
 *
 * Tracks the currently open folder and derives the items, subfolders, parent id,
 * and breadcrumb trail for that folder. `navigateToFolder` updates the local
 * state and mirrors it into the drawer store (`setDrawerCurrentFolderId`) in one
 * step, so navigation and the store's notion of the current folder never drift
 * apart.
 *
 * The parent-folder id is resolved in O(1) from a cached chain of folder ids
 * (`currentFolderPath`) rather than by re-traversing the folder tree - preserve
 * this when reading the code.
 *
 * @returns The current folder id, the store-syncing `navigateToFolder`, the
 *   cached folder-path chain, and the derived view (`currentItems`,
 *   `currentFolders`, `parentFolderId`, `breadcrumbPath`).
 */
export function useDrawerNavigation() {
   const folders = useDrawerStore((state) => state.drawer.folders);
   const rootItems = useDrawerStore((state) => state.drawer.rootItems);
   const { setDrawerCurrentFolderId } = useDrawerActions();

   const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

   const navigateToFolder = (id: string | null) => {
      setCurrentFolderId(id);
      setDrawerCurrentFolderId(id);
   };

   // Cache folder path as chain of IDs: ['rootId', 'childId', 'currentId']
   // Provides O(1) access to parent folder ID
   const currentFolderPath = useMemo(() => buildFolderPathIds(folders, currentFolderId), [folders, currentFolderId]);

   const { currentItems, currentFolders, parentFolderId } = useMemo(() => {
      if (!currentFolderId) {
         return { currentItems: rootItems, currentFolders: folders, parentFolderId: null };
      }
      const folder = findFolderMemoized(folders, currentFolderId);
      if (folder) {
         // O(1) parent lookup using cached path instead of O(n) tree traversal
         const parentId = getParentFromPath(currentFolderPath);
         return { currentItems: folder.items, currentFolders: folder.folders, parentFolderId: parentId };
      }
      return { currentItems: rootItems, currentFolders: folders, parentFolderId: null };
   }, [currentFolderId, folders, rootItems, currentFolderPath]);

   const breadcrumbPath = useMemo(() => buildBreadcrumb(folders, currentFolderId), [folders, currentFolderId]);

   return {
      currentFolderId,
      navigateToFolder,
      currentFolderPath,
      currentItems,
      currentFolders,
      parentFolderId,
      breadcrumbPath,
   };
}
