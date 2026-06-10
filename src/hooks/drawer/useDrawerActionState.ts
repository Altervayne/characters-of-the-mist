// -- React Imports --
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import cuid from 'cuid';
import toast from 'react-hot-toast';

// -- Store Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';

// -- Type Imports --
import type { PendingDrawerItem } from '@/lib/stores/drawerStore';
import type { Folder as FolderType, DrawerItem } from '@/lib/types/drawer';



export type ActionType = 'add-folder' | 'rename-folder' | 'delete-folder' | 'add-item' | 'rename-item' | 'delete-item' | 'move-item' | 'move-folder';

export interface ActiveAction {
   id: string;
   type: ActionType;
   target?: FolderType | DrawerItem | PendingDrawerItem;
   parentId?: string | null;
}



/**
 * Owns the Drawer's modification-window action lifecycle: the active CRUD action,
 * the pending-item flow, and the dispatch of confirmed actions to the store.
 *
 * Pending-item lifecycle (non-obvious): when the parent drops a sheet item into
 * the drawer it sets `pendingItem` in the store; the effect here turns that into
 * an `add-item` action, opening the naming window. Confirming an `add-item`
 * creates the item and clears `pendingItem`; cancelling it also clears
 * `pendingItem`. That effect -> action -> clear cycle is kept here in one place.
 *
 * `handleConfirmAction` is the single CRUD-dispatch switch for every action type
 * (add/rename/delete/move for both folders and items). `handleAnimationComplete`
 * focuses the modification-window input after its slide-up animation; the exposed
 * `inputRef` is bound to that input (and, as a pre-existing quirk, also to the
 * file-import input in the shell).
 *
 * @param currentFolderId - The currently open folder, used as the parent for new
 *   folders created via `handleAddFolder`.
 * @returns The active action and its setter, the modification-window input ref,
 *   and the add / confirm / close / animation handlers.
 */
export function useDrawerActionState(currentFolderId: string | null) {
   const { t: tNotifications } = useTranslation();

   const pendingItem = useDrawerStore((state) => state.pendingItem);
   const {  addFolder, renameFolder, deleteFolder, moveFolder,
            addItem, renameItem, deleteItem, moveItem,
            clearPendingItemDrop } = useDrawerActions();

   const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);

   const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      if (pendingItem) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setActiveAction({
            id: cuid(),
            type: 'add-item',
            target: pendingItem,
         });
      }
    }, [pendingItem]);

   const handleAnimationComplete = () => {
      if (activeAction) {
         setTimeout(() => {
            inputRef.current?.focus();
         }, 0);
      }
   };

   const handleAddFolder = () => {
      setActiveAction({ id: cuid(), type: 'add-folder', parentId: currentFolderId });
   };

   const handleConfirmAction = (value?: string) => {
      if (!activeAction) return;
      const target = activeAction.target;


      switch (activeAction.type) {
         case 'add-folder':
            if (value) {
               addFolder(value, activeAction.parentId ?? undefined);
               toast.success(tNotifications('Notifications.drawer.folderCreated'));
            }
            break;

         case 'rename-folder':
            if (target && 'items' in target && value) {
               renameFolder(target.id, value);
               toast.success(tNotifications('Notifications.drawer.folderRenamed'));
            }
            break;

         case 'delete-folder':
            if (target && 'items' in target) {
               deleteFolder(target.id);
               toast.success(tNotifications('Notifications.drawer.folderDeleted'));
            }
            break;

         case 'move-folder':
            if (target && 'items' in target) {
               moveFolder(target.id, value);
               toast.success(tNotifications('Notifications.drawer.folderMoved'));
            }
            break;



         case 'rename-item':
            if (target && 'id' in target && 'content' in target && value) {
               renameItem(target.id, value);
               toast.success(tNotifications('Notifications.drawer.itemRenamed'));
            }
            break;

         case 'delete-item':
            if (target && 'id' in target && 'content' in target) {
               deleteItem(target.id);
               toast.success(tNotifications('Notifications.drawer.itemDeleted'));
            }
            break;

         case 'add-item':
            if (value && target && 'defaultName' in target) {
               const { game, type, content, parentFolderId } = target;
               addItem(value, game, type, content, parentFolderId);
               toast.success(tNotifications('Notifications.drawer.itemCreated'));
            }
            clearPendingItemDrop();
            break;

         case 'move-item':
            if (target && 'id' in target && 'content' in target) {
               moveItem(target.id, value);
               toast.success(tNotifications('Notifications.drawer.itemMoved'));
            }
            break;
      }

      setActiveAction(null);
   };

   const handleCloseModificationWindow = () => {
      if (activeAction?.type === 'add-item') {
         clearPendingItemDrop();
      }
      setActiveAction(null);
   };

   return {
      activeAction,
      setActiveAction,
      inputRef,
      handleAddFolder,
      handleConfirmAction,
      handleCloseModificationWindow,
      handleAnimationComplete,
   };
}
