import cuid from "cuid";
import type { DrawerItem, Folder } from "../types/drawer";



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

export function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
   const result = Array.from(list);
   const [removed] = result.splice(startIndex, 1);
   result.splice(endIndex, 0, removed);
   return result;
};

export function buildBreadcrumb(folders: Folder[], folderId: string | null): Folder[] {
   if (!folderId) return [];
   
   const path: Folder[] = [];
   let current: Folder | null = findFolder(folders, folderId);
   
   while (current) {
      path.unshift(current);
      current = findParentFolder(folders, current.id);
   }
   
   return path;
};



// --- Folders Recursive Helpers ---

export function findFolder(folders: Folder[], id: string): Folder | null {
   for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findFolder(folder.folders, id);
      if (found) return found;
   }
   return null;
};

export function findParentFolder(folders: Folder[], childId: string): Folder | null {
   for (const folder of folders) {
      if (folder.folders.some(f => f.id === childId)) return folder;
      const found = findParentFolder(folder.folders, childId);
      if (found) return found;
   }
   return null;
};

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

export function addFolderRecursively(folders: Folder[], newFolder: Folder, parentFolderId: string): Folder[] {
    return folders.map(folder => {
        if (folder.id === parentFolderId) {
            return { ...folder, folders: [...folder.folders, newFolder] };
        }
        return { ...folder, folders: addFolderRecursively(folder.folders, newFolder, parentFolderId) };
    });
};

export function renameFolderRecursively(folders: Folder[], folderId: string, newName: string): Folder[] {
    return folders.map(folder => {
        if (folder.id === folderId) {
            return { ...folder, name: newName };
        }
        return { ...folder, folders: renameFolderRecursively(folder.folders, folderId, newName) };
    });
};

export function deleteFolderRecursively(folders: Folder[], folderId: string): Folder[] {
    const filteredFolders = folders.filter(folder => folder.id !== folderId);
    return filteredFolders.map(folder => {
        return { ...folder, folders: deleteFolderRecursively(folder.folders, folderId) };
    });
};

export function findAndRemoveFolder(folders: Folder[], folderId: string): { folder: Folder | null; updatedFolders: Folder[] } {
   let foundFolder: Folder | null = null;
   const removeRecursively = (currentFolders: Folder[]): Folder[] => {
      const folderIndex = currentFolders.findIndex(folder => folder.id === folderId);
      if (folderIndex > -1) {
         foundFolder = currentFolders[folderIndex];
         return currentFolders.filter(folder => folder.id !== folderId);
      }
      return currentFolders.map(folder => ({ ...folder, folders: removeRecursively(folder.folders) }));
   };
   const updatedFolders = removeRecursively(folders);
   return { folder: foundFolder, updatedFolders };
};

export function reorderFoldersRecursively(folders: Folder[], parentFolderId: string, oldIndex: number, newIndex: number): Folder[] {
   return folders.map(folder => {
      if (folder.id === parentFolderId) {
         return { ...folder, folders: reorderList(folder.folders, oldIndex, newIndex) };
      }
      return { ...folder, folders: reorderFoldersRecursively(folder.folders, parentFolderId, oldIndex, newIndex) };
   });
};

export function mergeIntoFolderRecursively(folders: Folder[], parentFolderId: string, foldersToAdd: Folder[], itemsToAdd: DrawerItem[]): Folder[] {
   return folders.map(folder => {
      if (folder.id === parentFolderId) {
         return {
         ...folder,
         folders: [...folder.folders, ...foldersToAdd],
         items: [...folder.items, ...itemsToAdd],
         };
      }
      if (folder.folders.length > 0) {
         return {
         ...folder,
         folders: mergeIntoFolderRecursively(folder.folders, parentFolderId, foldersToAdd, itemsToAdd),
         };
      }
      return folder;
   });
}

// --- Items Recursive Helpers ---

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

export function addItemRecursively(folders: Folder[], newItem: DrawerItem, parentFolderId: string): Folder[] {
   return folders.map(folder => {
      if (folder.id === parentFolderId) {
         return { ...folder, items: [...folder.items, newItem] };
      }
      return { ...folder, folders: addItemRecursively(folder.folders, newItem, parentFolderId) };
   });
};

export function renameItemRecursively(folders: Folder[], itemId: string, newName: string): Folder[] {
   return folders.map(folder => ({
      ...folder,
      items: folder.items.map(item => item.id === itemId ? { ...item, name: newName } : item),
      folders: renameItemRecursively(folder.folders, itemId, newName),
   }));
};

export function deleteItemRecursively(folders: Folder[], itemId: string): Folder[] {
   return folders.map(folder => ({
      ...folder,
      items: folder.items.filter(item => item.id !== itemId),
      folders: deleteItemRecursively(folder.folders, itemId),
   }));
};

export function findAndRemoveItem(folders: Folder[], itemId: string): { item: DrawerItem | null; updatedFolders: Folder[] } {
   let foundItem: DrawerItem | null = null;
   const removeRecursively = (currentFolders: Folder[]): Folder[] => {
      return currentFolders.map(folder => {
         const itemIndex = folder.items.findIndex(item => item.id === itemId);
         if (itemIndex > -1) {
            foundItem = folder.items[itemIndex];
            return { ...folder, items: folder.items.filter(item => item.id !== itemId) };
         }
         return { ...folder, folders: removeRecursively(folder.folders) };
      });
   };
   const updatedFolders = removeRecursively(folders);
   return { item: foundItem, updatedFolders };
};

export function reorderItemsRecursively(folders: Folder[], parentFolderId: string, oldIndex: number, newIndex: number): Folder[] {
   return folders.map(folder => {
      if (folder.id === parentFolderId) {
         return { ...folder, items: reorderList(folder.items, oldIndex, newIndex) };
      }
      return { ...folder, folders: reorderItemsRecursively(folder.folders, parentFolderId, oldIndex, newIndex) };
   });
};