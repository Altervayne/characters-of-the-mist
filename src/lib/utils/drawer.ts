import cuid from "cuid";
import type { DrawerItem, Folder } from "../types/drawer";


/**
 * Recursively clones an object and regenerates all `id` fields with fresh cuids.
 * Useful when duplicating drawer items or folders - ensures every copy gets unique IDs.
 */
export function deepReId<T extends object>(obj: T): T {
   if (obj === null || typeof obj !== 'object') {
      return obj;
   }

   if (Array.isArray(obj)) {
      return obj.map(item => (typeof item === 'object' && item !== null ? deepReId(item) : item)) as T;
   }

   // Using any here is perfectly intentional, as it could quite literally be
   // any object.
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const newObj: { [key: string]: unknown } = { ...obj as any };
   if ('id' in newObj && typeof newObj.id === 'string') {
      newObj.id = cuid();
   }

   for (const key in newObj) {
      if (Object.prototype.hasOwnProperty.call(newObj, key)) {
         const value = newObj[key];
         if (typeof value === 'object' && value !== null) {
            newObj[key] = deepReId(value as T);
         }
      }
   }

   return newObj as T;
};

/**
 * Reorders items in a list by moving an item from one index to another.
 * Used for drag-and-drop reordering of cards, trackers, folders, and drawer items.
 */
export function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
   const result = Array.from(list);
   const [removed] = result.splice(startIndex, 1);
   result.splice(endIndex, 0, removed);
   return result;
};

/**
 * Builds breadcrumb path from root to target folder.
 * Uses memoized lookups for O(1) folder access after initial cache build.
 */
export function buildBreadcrumb(folders: Folder[], folderId: string | null): Folder[] {
   if (!folderId) return [];

   const path: Folder[] = [];
   let current: Folder | null = findFolderMemoized(folders, folderId);

   while (current) {
      path.unshift(current);
      current = findParentFolderMemoized(folders, current.id);
   }

   return path;
};

/**
 * Builds a path as a chain of folder IDs from root to target folder.
 * Returns array like: ['rootFolderId', 'childFolderId', 'currentFolderId']
 * Uses memoized lookups for O(1) folder access.
 */
export function buildFolderPathIds(folders: Folder[], folderId: string | null): string[] {
   if (!folderId) return [];

   const path: string[] = [];
   let current: Folder | null = findFolderMemoized(folders, folderId);

   while (current) {
      path.unshift(current.id);
      current = findParentFolderMemoized(folders, current.id);
   }

   return path;
};

/**
 * Gets parent folder ID from a folder path chain.
 * O(1) operation - just returns second-to-last element.
 */
export function getParentFromPath(path: string[]): string | null {
   return path.length > 1 ? path[path.length - 2] : null;
};

/**
 * Navigates up N levels in the folder path.
 * O(1) operation using cached path.
 */
export function navigateUpPath(path: string[], levels: number = 1): string | null {
   const targetIndex = path.length - 1 - levels;
   return targetIndex >= 0 ? path[targetIndex] : null;
};



// --- Folders Recursive Helpers ---

/**
 * Recursively searches for a folder by ID through the entire folder tree.
 * Simple O(n) traversal - if you need repeated lookups, use the memoized version instead.
 */
export function findFolder(folders: Folder[], id: string): Folder | null {
   for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findFolder(folder.folders, id);
      if (found) return found;
   }
   return null;
};

/**
 * Finds the parent folder of a given folder by searching through the tree.
 * Returns null if the folder is at root level or doesn't exist.
 */
export function findParentFolder(folders: Folder[], childId: string): Folder | null {
   for (const folder of folders) {
      if (folder.folders.some(f => f.id === childId)) return folder;
      const found = findParentFolder(folder.folders, childId);
      if (found) return found;
   }
   return null;
};

/**
 * Another recursive folder finder - basically the same as findFolder.
 * Kept for backwards compatibility, but you should probably just use findFolder.
 */
export function findFolderById(folders: Folder[], folderId: string): Folder | null {
   for (const folder of folders) {
      if (folder.id === folderId) {
         return folder;
      }
      const foundInSubfolder = findFolderById(folder.folders, folderId);
      if (foundInSubfolder) {
         return foundInSubfolder;
      }
   }
   return null;
};



// --- Memoized Lookup Helpers ---
const folderCacheMap = new WeakMap<Folder[], Map<string, Folder>>();
const parentCacheMap = new WeakMap<Folder[], Map<string, Folder>>();

/**
 * Lightning-fast folder lookup using a WeakMap cache.
 * First call builds the cache (O(n)), but subsequent lookups are instant (O(1)).
 * Cache automatically invalidates when the folder array changes - Zustand's immutability takes care of that.
 */
export function findFolderMemoized(folders: Folder[], folderId: string): Folder | null {
    let cache = folderCacheMap.get(folders);

    if (!cache) {
        // Build cache on first access
        cache = new Map();
        const buildCache = (folderList: Folder[]) => {
            folderList.forEach(folder => {
                cache!.set(folder.id, folder);
                buildCache(folder.folders);
            });
        };
        buildCache(folders);
        folderCacheMap.set(folders, cache);
    }

    return cache.get(folderId) ?? null;
}

/**
 * Memoized parent folder lookup - same caching magic as findFolderMemoized.
 * Returns the parent of a given folder, or null if it's at root level.
 */
export function findParentFolderMemoized(folders: Folder[], folderId: string): Folder | null {
    let cache = parentCacheMap.get(folders);

    if (!cache) {
        cache = new Map();
        const buildParentCache = (folderList: Folder[], parent: Folder | null = null) => {
            folderList.forEach(folder => {
                if (parent) {
                    cache!.set(folder.id, parent);
                }
                buildParentCache(folder.folders, folder);
            });
        };
        buildParentCache(folders);
        parentCacheMap.set(folders, cache);
    }

    return cache.get(folderId) ?? null;
}

/**
 * Adds a new folder as a child of the specified parent folder.
 * Recursively searches the tree to find the parent, then adds the new folder to it.
 * Uses early exit optimization - stops searching once the folder is added.
 */
export function addFolderRecursively(folders: Folder[], newFolder: Folder, parentFolderId: string): Folder[] {
    let found = false;

    const updated = folders.map(folder => {
        if (found) return folder;

        if (folder.id === parentFolderId) {
            found = true;
            return { ...folder, folders: [...folder.folders, newFolder] };
        }

        const updatedSubfolders = addFolderRecursively(folder.folders, newFolder, parentFolderId);

        if (updatedSubfolders === folder.folders) {
            return folder;
        }

        return { ...folder, folders: updatedSubfolders };
    });

    return found || updated !== folders ? updated : folders;
};

/**
 * Renames a folder in the tree by finding it and updating its name property.
 * Preserves reference equality for unchanged folders - only the path to the renamed folder gets cloned.
 */
export function renameFolderRecursively(folders: Folder[], folderId: string, newName: string): Folder[] {
    let found = false;

    const updated = folders.map(folder => {
        if (found) return folder;

        if (folder.id === folderId) {
            found = true;
            return { ...folder, name: newName };
        }

        const updatedSubfolders = renameFolderRecursively(folder.folders, folderId, newName);
        if (updatedSubfolders === folder.folders) {
            return folder;
        }

        return { ...folder, folders: updatedSubfolders };
    });

    return found || updated !== folders ? updated : folders;
};

/**
 * Deletes a folder and all its contents from the tree.
 * Recursively searches and removes the folder - everything inside is gone, so use with caution!
 */
export function deleteFolderRecursively(folders: Folder[], folderId: string): Folder[] {
    let changed = false;

    const filtered = folders.filter(folder => {
        if (folder.id === folderId) {
            changed = true;
            return false;
        }
        return true;
    });

    if (changed && filtered.length === 0) {
        return filtered;
    }

    const updated = filtered.map(folder => {
        const updatedSubfolders = deleteFolderRecursively(folder.folders, folderId);

        if (updatedSubfolders === folder.folders) {
            return folder;
        }

        changed = true;
        return { ...folder, folders: updatedSubfolders };
    });

    return changed ? updated : folders;
};

/**
 * Finds a folder, removes it from the tree, and returns both the folder and the updated tree.
 * Handy for move operations - you can grab the folder and put it somewhere else.
 */
export function findAndRemoveFolder(folders: Folder[], folderId: string): { folder: Folder | null; updatedFolders: Folder[] } {
   let foundFolder: Folder | null = null;

   const removeRecursively = (currentFolders: Folder[]): Folder[] => {
      if (foundFolder) return currentFolders;

      const folderIndex = currentFolders.findIndex(folder => folder.id === folderId);
      if (folderIndex > -1) {
         foundFolder = currentFolders[folderIndex];
         return currentFolders.filter(folder => folder.id !== folderId);
      }

      let changed = false;
      const updated = currentFolders.map(folder => {
         if (foundFolder) return folder;

         const updatedSubfolders = removeRecursively(folder.folders);
         if (updatedSubfolders === folder.folders) {
            return folder;
         }

         changed = true;
         return { ...folder, folders: updatedSubfolders };
      });

      return changed ? updated : currentFolders;
   };

   const updatedFolders = removeRecursively(folders);
   return { folder: foundFolder, updatedFolders };
};

/**
 * Reorders child folders within a parent folder by moving one from oldIndex to newIndex.
 * Used for drag-and-drop folder reordering in the drawer.
 */
export function reorderFoldersRecursively(folders: Folder[], parentFolderId: string, oldIndex: number, newIndex: number): Folder[] {
   let found = false;

   const updated = folders.map(folder => {
      if (found) return folder;

      if (folder.id === parentFolderId) {
         found = true;
         return { ...folder, folders: reorderList(folder.folders, oldIndex, newIndex) };
      }

      const updatedSubfolders = reorderFoldersRecursively(folder.folders, parentFolderId, oldIndex, newIndex);
      if (updatedSubfolders === folder.folders) {
         return folder;
      }

      return { ...folder, folders: updatedSubfolders };
   });

   return found || updated !== folders ? updated : folders;
};

/**
 * Merges folders and items into a target folder in one go.
 * Useful for bulk operations like importing multiple items or drag-dropping a selection.
 */
export function mergeIntoFolderRecursively(folders: Folder[], parentFolderId: string, foldersToAdd: Folder[], itemsToAdd: DrawerItem[]): Folder[] {
   let found = false;

   const updated = folders.map(folder => {
      if (found) return folder;

      if (folder.id === parentFolderId) {
         found = true;
         return {
            ...folder,
            folders: [...folder.folders, ...foldersToAdd],
            items: [...folder.items, ...itemsToAdd],
         };
      }

      if (folder.folders.length > 0) {
         const updatedSubfolders = mergeIntoFolderRecursively(folder.folders, parentFolderId, foldersToAdd, itemsToAdd);
         if (updatedSubfolders === folder.folders) {
            return folder;
         }

         return {
            ...folder,
            folders: updatedSubfolders,
         };
      }

      return folder;
   });

   return found || updated !== folders ? updated : folders;
}



// --- Items Recursive Helpers ---

/**
 * Finds which folder contains a specific item.
 * Recursively searches through the tree until it finds a folder with that item in its items array.
 */
export function findItemFolder(folders: Folder[], itemId: string): Folder | null {
   for (const folder of folders) {
      if (folder.items.some(i => i.id === itemId)) {
         return folder;
      }
      const foundInSubfolder = findItemFolder(folder.folders, itemId);
      if (foundInSubfolder) {
         return foundInSubfolder;
      }
   }
   return null;
}

/**
 * Adds a new item to the specified folder's items array.
 * Same recursive pattern as addFolderRecursively - finds the parent and adds the item.
 */
export function addItemRecursively(folders: Folder[], newItem: DrawerItem, parentFolderId: string): Folder[] {
   let found = false;

   const updated = folders.map(folder => {
      if (found) return folder; // Early exit

      if (folder.id === parentFolderId) {
         found = true;
         return { ...folder, items: [...folder.items, newItem] };
      }

      const updatedSubfolders = addItemRecursively(folder.folders, newItem, parentFolderId);
      if (updatedSubfolders === folder.folders) {
         return folder;
      }

      return { ...folder, folders: updatedSubfolders };
   });

   return found || updated !== folders ? updated : folders;
};

/**
 * Renames an item in the tree by finding it and updating its name property.
 * Searches through all folders to find the item, wherever it might be hiding.
 */
export function renameItemRecursively(folders: Folder[], itemId: string, newName: string): Folder[] {
   let changed = false;

   const updated = folders.map(folder => {
      const updatedItems = folder.items.map(item => {
         if (item.id === itemId) {
            changed = true;
            return { ...item, name: newName };
         }
         return item;
      });

      const updatedSubfolders = renameItemRecursively(folder.folders, itemId, newName);

      if (updatedItems === folder.items && updatedSubfolders === folder.folders) {
         return folder;
      }

      changed = true;
      return { ...folder, items: updatedItems, folders: updatedSubfolders };
   });

   return changed ? updated : folders;
};

/**
 * Deletes an item from the tree by removing it from its parent folder's items array.
 * Recursively searches to find and remove the item - it's gone for good once deleted.
 */
export function deleteItemRecursively(folders: Folder[], itemId: string): Folder[] {
   let changed = false;

   const updated = folders.map(folder => {
      const updatedItems = folder.items.filter(item => {
         if (item.id === itemId) {
            changed = true;
            return false;
         }
         return true;
      });

      const updatedSubfolders = deleteItemRecursively(folder.folders, itemId);

      if (updatedItems.length === folder.items.length && updatedSubfolders === folder.folders) {
         return folder;
      }

      changed = true;
      return { ...folder, items: updatedItems, folders: updatedSubfolders };
   });

   return changed ? updated : folders;
};

/**
 * Finds an item, removes it from the tree, and returns both the item and the updated tree.
 * Perfect for move operations - grab the item and relocate it somewhere else in the drawer.
 */
export function findAndRemoveItem(folders: Folder[], itemId: string): { item: DrawerItem | null; updatedFolders: Folder[] } {
   let foundItem: DrawerItem | null = null;

   const removeRecursively = (currentFolders: Folder[]): Folder[] => {
      if (foundItem) return currentFolders;

      let changed = false;
      const updated = currentFolders.map(folder => {
         if (foundItem) return folder;

         const itemIndex = folder.items.findIndex(item => item.id === itemId);
         if (itemIndex > -1) {
            foundItem = folder.items[itemIndex];
            changed = true;
            return { ...folder, items: folder.items.filter(item => item.id !== itemId) };
         }

         const updatedSubfolders = removeRecursively(folder.folders);
         if (updatedSubfolders === folder.folders) {
            return folder;
         }

         changed = true;
         return { ...folder, folders: updatedSubfolders };
      });

      return changed ? updated : currentFolders;
   };

   const updatedFolders = removeRecursively(folders);
   return { item: foundItem, updatedFolders };
};

/**
 * Reorders items within a folder's items array by moving one from oldIndex to newIndex.
 * Used for drag-and-drop item reordering in the drawer.
 */
export function reorderItemsRecursively(folders: Folder[], parentFolderId: string, oldIndex: number, newIndex: number): Folder[] {
   let found = false;

   const updated = folders.map(folder => {
      if (found) return folder;

      if (folder.id === parentFolderId) {
         found = true;
         return { ...folder, items: reorderList(folder.items, oldIndex, newIndex) };
      }

      const updatedSubfolders = reorderItemsRecursively(folder.folders, parentFolderId, oldIndex, newIndex);
      if (updatedSubfolders === folder.folders) {
         return folder;
      }

      return { ...folder, folders: updatedSubfolders };
   });

   return found || updated !== folders ? updated : folders;
};