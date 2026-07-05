// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Utils Imports --
import { getDrawerItemDisplayPath } from '@/lib/drawer/drawerItemPath';
import { saveBoardItemAsToDrawer, saveBoardItemToLinkedDrawerItem } from '@/lib/board/boardItemSaveBack';

// -- Store Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

/*
 * Save-back for a board card/tracker copy, shared by the item's overflow menu (and later the palette) so the
 * entry points can't drift. Save writes the copy's edited inner aggregate back to its linked drawer item by
 * id; a dangling link falls back to Save As transparently. Save As mints a fresh drawer item, opens the
 * drawer's naming window, and adopts the new id onto the board item so a later Save writes back. The adopt
 * is optimistic (before the name is confirmed - a cancelled name leaves a harmless dangling source that Save
 * just re-forks) and NON-undoable (bookkeeping, not a user edit; Ctrl+Z must undo the real prior board edit,
 * not silently unlink the twin). Toasts confirm the write.
 */

interface UseBoardItemSaveBackArgs {
   /** The current copy content (its `sourceDrawerItemId` and inner `data`). */
   content: { sourceDrawerItemId?: string; data: unknown };
   /** Adopts the minted drawer id onto the copy's source link via a direct (non-undoable) write. */
   onAdoptSource: (sourceDrawerItemId: string) => void;
}

export function useBoardItemSaveBack({ content, onAdoptSource }: UseBoardItemSaveBackArgs) {
   const { t } = useTranslation();
   const drawerCurrentFolderId = useDrawerStore((state) => state.currentFolderId);
   const isDrawerOpen = useAppGeneralStateStore((state) => state.isDrawerOpen);
   const { setDrawerOpen } = useAppGeneralStateActions();

   const saveItemAs = useCallback(() => {
      const newId = saveBoardItemAsToDrawer(content.data, drawerCurrentFolderId ?? undefined);
      if (!newId) {
         toast.error(t('Notifications.drawer.actionFailed'));
         return;
      }
      // Adopt the minted id now (optimistic, non-undoable), so a later Save writes back.
      onAdoptSource(newId);
      // The naming window renders inside the drawer; open it so the flow is visible (like the sheet Save As).
      if (!isDrawerOpen) setDrawerOpen(true);
   }, [content, drawerCurrentFolderId, isDrawerOpen, onAdoptSource, setDrawerOpen, t]);

   const saveItem = useCallback(async () => {
      const sourceId = content.sourceDrawerItemId;
      if (!sourceId) {
         saveItemAs();
         return;
      }
      try {
         const { linkedItemUpdated } = await saveBoardItemToLinkedDrawerItem(sourceId, content.data);
         if (linkedItemUpdated) {
            const itemPath = await getDrawerItemDisplayPath(sourceId);
            toast.success(`${t('Notifications.board.itemSaved')} ${itemPath}`);
            void useDrawerStore.getState().actions.reloadCurrentFolder();
         } else {
            // The linked drawer item was deleted: fall back to Save As + notify.
            saveItemAs();
            toast(t('Notifications.board.itemLinkedItemMissing'));
         }
      } catch {
         toast.error(t('Notifications.drawer.actionFailed'));
      }
   }, [content, saveItemAs, t]);

   return { saveItem, saveItemAs };
}
