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
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';



export type ActionType = 'add-folder' | 'rename-folder' | 'delete-folder' | 'add-item' | 'rename-item' | 'delete-item' | 'move-item' | 'move-folder';

/** The target of an action: a flat folder/item record, or a pending dropped item. */
export type ActiveActionTarget = DrawerFolderRecord | DrawerItemRecord | PendingDrawerItem;

export interface ActiveAction {
   id: string;
   type: ActionType;
   target?: ActiveActionTarget;
   parentId?: string | null;
}

/** A folder record carries `order` but no `content` (which items have) and no `defaultName` (pending items have). */
function isFolderTarget(target: ActiveActionTarget | undefined): target is DrawerFolderRecord {
   return !!target && 'order' in target && !('content' in target);
}

/** An item record carries both `content` and `order` (a pending item has `content` but no `order`). */
function isItemTarget(target: ActiveActionTarget | undefined): target is DrawerItemRecord {
   return !!target && 'content' in target && 'order' in target;
}

/** A pending dropped item carries `defaultName`. */
function isPendingTarget(target: ActiveActionTarget | undefined): target is PendingDrawerItem {
   return !!target && 'defaultName' in target;
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
 * `inputRef` is bound only to that input.
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

   const handleConfirmAction = async (value?: string) => {
      if (!activeAction) return;
      const target = activeAction.target;

      // Each action now dispatches an async store action (command -> repository).
      // Success toasts stay here per the spec; a failure surfaces a single generic
      // toast (the store has already recorded the error in its `error` state).
      try {
         switch (activeAction.type) {
            case 'add-folder':
               if (value) {
                  await addFolder(value, activeAction.parentId ?? undefined);
                  toast.success(tNotifications('Notifications.drawer.folderCreated'));
               }
               break;

            case 'rename-folder':
               if (isFolderTarget(target) && value) {
                  await renameFolder(target.id, value);
                  toast.success(tNotifications('Notifications.drawer.folderRenamed'));
               }
               break;

            case 'delete-folder':
               if (isFolderTarget(target)) {
                  await deleteFolder(target.id);
                  toast.success(tNotifications('Notifications.drawer.folderDeleted'));
               }
               break;

            case 'move-folder':
               if (isFolderTarget(target)) {
                  await moveFolder(target.id, value);
                  toast.success(tNotifications('Notifications.drawer.folderMoved'));
               }
               break;

            case 'rename-item':
               if (isItemTarget(target) && value) {
                  await renameItem(target.id, value);
                  toast.success(tNotifications('Notifications.drawer.itemRenamed'));
               }
               break;

            case 'delete-item':
               if (isItemTarget(target)) {
                  await deleteItem(target.id);
                  toast.success(tNotifications('Notifications.drawer.itemDeleted'));
               }
               break;

            case 'add-item':
               if (value && isPendingTarget(target)) {
                  const { game, type, content, parentFolderId } = target;
                  await addItem(value, game, type, content, parentFolderId);
                  toast.success(tNotifications('Notifications.drawer.itemCreated'));
               }
               clearPendingItemDrop();
               break;

            case 'move-item':
               if (isItemTarget(target)) {
                  await moveItem(target.id, value);
                  toast.success(tNotifications('Notifications.drawer.itemMoved'));
               }
               break;
         }
      } catch {
         toast.error(tNotifications('Notifications.drawer.actionFailed'));
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
