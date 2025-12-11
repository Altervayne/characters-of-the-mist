// -- Other Library Imports --
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import cuid from 'cuid';

// -- Utils Imports --
import { addFolderRecursively, addItemRecursively, deepReId, deleteFolderRecursively, deleteItemRecursively, findAndRemoveFolder, findAndRemoveItem, mergeIntoFolderRecursively, renameFolderRecursively, renameItemRecursively, reorderFoldersRecursively, reorderItemsRecursively, reorderList } from '../utils/drawer';
import { STORE_VERSION } from '../config';

// -- Store and Hook Imports --
import { useAppGeneralStateStore } from './appGeneralStateStore';

// -- Type Imports --
import { Drawer, Folder, DrawerItem, DrawerItemContent, GeneralItemType, GameSystem } from '@/lib/types/drawer';
import { harmonizeData } from '../harmonization';



export interface PendingDrawerItem {
   game: GameSystem;
   type: GeneralItemType;
   content: DrawerItemContent;
   parentFolderId?: string;
   defaultName: string;
   presetId?: string;
}



export interface DrawerState {
   drawer: Drawer;
   pendingItem: PendingDrawerItem | null;
   actions: {
      // --- Drawer Actions ---
      importFullDrawer: (newDrawer: Drawer, parentFolderId?: string) => void;
      // --- Folder Actions ---
      addFolder: (name: string, parentFolderId?: string) => void;
      addImportedFolder: (folder: Folder, parentFolderId?: string) => void;
      renameFolder: (folderId: string, newName: string) => void;
      deleteFolder: (folderId: string) => void;
      moveFolder: (folderId: string, destinationFolderId?: string) => void;
      reorderFolders: (parentFolderId: string | null, oldIndex: number, newIndex: number) => void;
      // --- Item Actions ---
      addItem: (name: string, game: GameSystem, type: GeneralItemType, content: DrawerItemContent, parentFolderId?: string) => void;
      addImportedItem: (itemContent: DrawerItemContent, itemType: GeneralItemType, game: GameSystem, parentFolderId?: string) => void;
      renameItem: (itemId: string, newName: string) => void;
      deleteItem: (itemId: string) => void;
      moveItem: (itemId: string, destinationFolderId?: string) => void;
      reorderItems: (parentFolderId: string | null, oldIndex: number, newIndex: number) => void;
      updateItem: (itemId: string, newContent: DrawerItemContent, newName?: string) => void;
      // --- Drop Actions ---
      initiateItemDrop: (itemInfo: PendingDrawerItem) => void;
      clearPendingItemDrop: () => void;
   };
}

const initialState: Pick<DrawerState, 'drawer' | 'pendingItem'> = {
   drawer: {
      folders: [],
      rootItems: [],
   },
   pendingItem: null,
};



export const useDrawerStore = create<DrawerState>()(
   temporal(
      persist(
         (set) => ({
            ...initialState,
            actions: {
               // --- Drawer Actions ---
               importFullDrawer: (newDrawer, parentFolderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     const reIddDrawer = deepReId(newDrawer);

                     if (!parentFolderId) {
                        const mergedFolders = [...state.drawer.folders, ...reIddDrawer.folders];
                        const mergedRootItems = [...state.drawer.rootItems, ...reIddDrawer.rootItems];
                        return {
                           drawer: {
                              ...state.drawer,
                              folders: mergedFolders,
                              rootItems: mergedRootItems,
                           }
                        };
                     } else {
                        const updatedFolders = mergeIntoFolderRecursively(
                           state.drawer.folders,
                           parentFolderId,
                           reIddDrawer.folders,
                           reIddDrawer.rootItems
                        );
                        return { drawer: { ...state.drawer, folders: updatedFolders } };
                     }
                  });
               },
               // --- Folder Actions ---
               addFolder: (name, parentFolderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     const newFolder: Folder = { id: cuid(), name, items: [], folders: [] };
                     
                     if (!parentFolderId) {
                        return {
                           drawer: {
                              ...state.drawer,
                              folders: [...state.drawer.folders, newFolder],
                           }
                        };
                     } else {
                        const newFolders = addFolderRecursively(state.drawer.folders, newFolder, parentFolderId);
                        return {
                           drawer: {
                              ...state.drawer,
                              folders: newFolders,
                           }
                        };
                     }
                  });
               },
               addImportedFolder: (folder, parentFolderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     const newFolder = deepReId(folder);

                     if (!parentFolderId) {
                        return {
                           drawer: {
                              ...state.drawer,
                              folders: [...state.drawer.folders, newFolder],
                           }
                        };
                     } else {
                        const newFolders = addFolderRecursively(state.drawer.folders, newFolder, parentFolderId);
                        return {
                           drawer: {
                              ...state.drawer,
                              folders: newFolders,
                           }
                        };
                     }
                  });
               },
               renameFolder: (folderId, newName) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     return {
                        drawer: {
                           ...state.drawer,
                           folders: renameFolderRecursively(state.drawer.folders, folderId, newName),
                        }
                     }
                  });
               },
               deleteFolder: (folderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     return {
                        drawer: {
                           ...state.drawer,
                           folders: deleteFolderRecursively(state.drawer.folders, folderId),
                        }
                     }
                  });
               },
               moveFolder: (folderId, destinationFolderId) => {
                  set(state => {
                     if (folderId === destinationFolderId) return state;
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');

                     const { folder: folderToMove, updatedFolders } = findAndRemoveFolder(state.drawer.folders, folderId);

                     if (!folderToMove) return state;

                     let finalFolders: Folder[];
                     if (!destinationFolderId) {
                        finalFolders = [...updatedFolders, folderToMove];
                     } else {
                        finalFolders = addFolderRecursively(updatedFolders, folderToMove, destinationFolderId);
                     }

                     return { drawer: { ...state.drawer, folders: finalFolders } };
                  });
               },
               reorderFolders: (parentFolderId, oldIndex, newIndex) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     if (!parentFolderId) {
                        return { drawer: { ...state.drawer, folders: reorderList(state.drawer.folders, oldIndex, newIndex) } };
                     }
                     return { drawer: { ...state.drawer, folders: reorderFoldersRecursively(state.drawer.folders, parentFolderId, oldIndex, newIndex) } };
                  });
               },
               // --- Item Actions ---
               addItem: (name, game, type, content, parentFolderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');

                     const presetId = ('drawerItemId' in content && content.drawerItemId) 
                        ? content.drawerItemId as string
                        : null;

                     const newItemContent = deepReId(content);
                     const itemId = presetId || cuid();
                     
                     const newItem: DrawerItem = { id: itemId, name, game, type, content: newItemContent };

                     if (!parentFolderId) {
                        return { drawer: { ...state.drawer, rootItems: [...state.drawer.rootItems, newItem] } };
                     } else {
                        const newFolders = addItemRecursively(state.drawer.folders, newItem, parentFolderId);
                        return { drawer: { ...state.drawer, folders: newFolders } };
                     }
                  });
               },
               addImportedItem: (itemContent, itemType, game, parentFolderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     const newItemContent = deepReId(itemContent);
                     const name = 'title' in newItemContent ? newItemContent.title : newItemContent.name;

                     const newItem: DrawerItem = {
                        id: cuid(),
                        name,
                        game: game,
                        type: itemType,
                        content: newItemContent,
                     };

                     if (!parentFolderId) {
                        return { drawer: { ...state.drawer, rootItems: [...state.drawer.rootItems, newItem] } };
                     } else {
                        const newFolders = addItemRecursively(state.drawer.folders, newItem, parentFolderId);
                        return { drawer: { ...state.drawer, folders: newFolders } };
                     }
                  });
               },
               renameItem: (itemId, newName) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     return {
                        drawer: {
                           ...state.drawer,
                           rootItems: state.drawer.rootItems.map(item => 
                              item.id === itemId ? { ...item, name: newName } : item
                           ),
                           folders: renameItemRecursively(state.drawer.folders, itemId, newName),
                        }
                     }
                  });
               },
               deleteItem: (itemId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     return {
                        drawer: {
                           ...state.drawer,
                           rootItems: state.drawer.rootItems.filter(item => item.id !== itemId),
                           folders: deleteItemRecursively(state.drawer.folders, itemId),
                        }
                     }
                  });
               },
               moveItem: (itemId, destinationFolderId) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     let itemToMove: DrawerItem | null = null;
                     const updatedDrawer = { ...state.drawer };

                     const rootItemIndex = updatedDrawer.rootItems.findIndex(item => item.id === itemId);
                     if (rootItemIndex > -1) {
                        itemToMove = updatedDrawer.rootItems[rootItemIndex];
                        updatedDrawer.rootItems = updatedDrawer.rootItems.filter(item => item.id !== itemId);
                     } else {
                        const result = findAndRemoveItem(updatedDrawer.folders, itemId);
                        itemToMove = result.item;
                        updatedDrawer.folders = result.updatedFolders;
                     }

                     if (!itemToMove) return state;

                     if (!destinationFolderId) {
                        updatedDrawer.rootItems = [...updatedDrawer.rootItems, itemToMove];
                     } else {
                        updatedDrawer.folders = addItemRecursively(updatedDrawer.folders, itemToMove, destinationFolderId);
                     }

                     return { drawer: updatedDrawer };
                  });
               },
               reorderItems: (parentFolderId, oldIndex, newIndex) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     if (!parentFolderId) {
                        return { drawer: { ...state.drawer, rootItems: reorderList(state.drawer.rootItems, oldIndex, newIndex) } };
                     }
                     return { drawer: { ...state.drawer, folders: reorderItemsRecursively(state.drawer.folders, parentFolderId, oldIndex, newIndex) } };
                  });
               },
               updateItem: (itemId, newContent, newName) => {
                  set(state => {
                     useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
                     
                     const updateRecursive = (items: DrawerItem[]): DrawerItem[] => {
                        return items.map(item => 
                           item.id === itemId 
                              ? { ...item, content: newContent, name: newName ?? item.name }
                              : item
                        );
                     };
                     
                     const updateInFolders = (folders: Folder[]): Folder[] => {
                        return folders.map(folder => ({
                           ...folder,
                           items: updateRecursive(folder.items),
                           folders: updateInFolders(folder.folders)
                        }));
                     };
                     
                     return {
                        drawer: {
                           ...state.drawer,
                           rootItems: updateRecursive(state.drawer.rootItems),
                           folders: updateInFolders(state.drawer.folders)
                        }
                     };
                  });
               },
               // --- Drop Actions ---
               initiateItemDrop: (itemInfo) => {
                  set({ pendingItem: itemInfo });
               },
               clearPendingItemDrop: () => {
                  set({ pendingItem: null });
               },
            },
         }),
         {
            name: 'characters-of-the-mist_drawer-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ drawer: state.drawer }),
            version: STORE_VERSION,
            migrate: (persistedState, version) => {
               const state = persistedState as Pick<DrawerState, 'drawer'>;

               if (state.drawer) {
                  console.log("Harmonizing drawer data via migrate function...");
                  state.drawer = harmonizeData(state.drawer, 'FULL_DRAWER');
                  console.log("Drawer data harmonization complete.");
               }
               
               return state;
            },
         }
      )
   )
);

export const useDrawerActions = () => useDrawerStore((state) => state.actions);