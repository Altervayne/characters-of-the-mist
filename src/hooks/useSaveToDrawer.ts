// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import cuid from 'cuid';

// -- Utils Imports --
import { getDrawerItemDisplayPath } from '@/lib/drawer/drawerItemPath';
import { saveCharacterToLinkedDrawerItem } from '@/lib/character/characterRepository';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { getActiveNoteStore } from '@/lib/notes/noteStoreRegistry';
import { stampNoteReferencesDrawerSource } from '@/lib/board/refreezeNoteReferences';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useDrawerActions, useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

/*
 * Save-to-drawer for the active character or board, shared by the sidebar Save buttons and the command
 * palette so the two entry points can't drift. Each kind has a Save (linked atomic save, or Save-As when
 * unlinked) and a Save-As (link a fresh drawer item, open the drawer, and hand off to the naming window).
 * A linked item that was deleted falls back to Save-As. The drawer-open step is self-sourced here.
 */
export function useSaveToDrawer() {
   const { t: tNotifications } = useTranslation();

   const character = useCharacterStore((state) => state.character);
   const drawerCurrentFolderId = useDrawerStore((state) => state.currentFolderId);
   const { loadCharacter, setHasUnsavedChanges } = useCharacterActions();
   const { initiateItemDrop, reloadCurrentFolder } = useDrawerActions();
   const isDrawerOpen = useAppGeneralStateStore((state) => state.isDrawerOpen);
   const { setDrawerOpen } = useAppGeneralStateActions();

   const saveCharacterToDrawer = async () => {
      if (!character) return;

      if (character.drawerItemId) {
         const savedItemId = character.drawerItemId;
         try {
            // Atomic cross-store save: working record + the linked drawer item in one
            // transaction.
            const { linkedItemUpdated } = await saveCharacterToLinkedDrawerItem(character);
            if (linkedItemUpdated) {
               // The working record now matches its drawer copy.
               setHasUnsavedChanges(false);
               await reloadCurrentFolder();
               const itemPath = await getDrawerItemDisplayPath(savedItemId);
               toast.success(`${tNotifications('Notifications.character.saved')} ${itemPath}`);
            } else {
               // The linked drawer item was deleted: fall back to Save As + notify.
               saveCharacterAsToDrawer();
               toast(tNotifications('Notifications.character.linkedItemMissing'));
            }
         } catch {
            toast.error(tNotifications('Notifications.drawer.actionFailed'));
         }
      } else {
         saveCharacterAsToDrawer();
      }
   };

   const saveCharacterAsToDrawer = () => {
      if (!character) return;

      const newItemId = cuid();
      const characterWithDrawerId = { ...character, drawerItemId: newItemId };

      loadCharacter(character, newItemId);
      // loadCharacter sets the flag clean, but the change subscription fires on the new
      // character reference and re-dirties it; assert clean once more after.
      setHasUnsavedChanges(false);

      if (!isDrawerOpen) {
         setDrawerOpen(true);
      }

      initiateItemDrop({
         game: character.game,
         type: 'FULL_CHARACTER_SHEET',
         content: characterWithDrawerId,
         defaultName: character.name,
         presetId: newItemId,
         parentFolderId: drawerCurrentFolderId ?? undefined,
      });
   };

   const saveBoardToDrawer = async () => {
      const store = getActiveBoardStore();
      if (!store) return;
      const { boardId, drawerItemId } = store.getState();
      if (!boardId) return;

      if (drawerItemId) {
         try {
            // Atomic cross-store save of the linked drawer copy, mirroring the character.
            const result = await store.getState().actions.saveToDrawer();
            if (result?.linkedItemUpdated) {
               await reloadCurrentFolder();
               const itemPath = await getDrawerItemDisplayPath(drawerItemId);
               toast.success(`${tNotifications('Notifications.board.saved')} ${itemPath}`);
            } else {
               // The linked drawer item was deleted: fall back to Save As + notify.
               await saveBoardAsToDrawer();
               toast(tNotifications('Notifications.board.linkedItemMissing'));
            }
         } catch {
            toast.error(tNotifications('Notifications.drawer.actionFailed'));
         }
      } else {
         await saveBoardAsToDrawer();
      }
   };

   const saveBoardAsToDrawer = async () => {
      const store = getActiveBoardStore();
      if (!store) return;
      const { boardId, name } = store.getState();
      if (!boardId) return;

      // Link the working board to a new drawer item id (also flushes the live viewport
      // and marks the board clean); the returned aggregate seeds the drawer item content.
      const newItemId = cuid();
      const aggregate = await store.getState().actions.linkToDrawerItem(newItemId);
      if (!aggregate) return;

      if (!isDrawerOpen) {
         setDrawerOpen(true);
      }

      // A board is game-agnostic -> a NEUTRAL drawer item; the naming window finalizes it.
      initiateItemDrop({
         game: 'NEUTRAL',
         type: 'FULL_BOARD',
         content: aggregate,
         defaultName: name,
         presetId: newItemId,
         parentFolderId: drawerCurrentFolderId ?? undefined,
      });
   };

   const saveNoteToDrawer = async () => {
      const store = getActiveNoteStore();
      if (!store) return;
      const { noteId, drawerItemId } = store.getState();
      if (!noteId) return;

      if (drawerItemId) {
         try {
            // Atomic cross-store save of the linked drawer copy, mirroring the board.
            const result = await store.getState().actions.saveToDrawer();
            if (result?.linkedItemUpdated) {
               // Keep any board tile referencing this note pointed at its drawer item (self-healing; a
               // first save stamps it, a re-save is a no-op).
               await stampNoteReferencesDrawerSource(noteId, drawerItemId);
               await reloadCurrentFolder();
               const itemPath = await getDrawerItemDisplayPath(drawerItemId);
               toast.success(`${tNotifications('Notifications.note.saved')} ${itemPath}`);
            } else {
               // The linked drawer item was deleted: fall back to Save As + notify.
               await saveNoteAsToDrawer();
               toast(tNotifications('Notifications.note.linkedItemMissing'));
            }
         } catch {
            toast.error(tNotifications('Notifications.drawer.actionFailed'));
         }
      } else {
         await saveNoteAsToDrawer();
      }
   };

   const saveNoteAsToDrawer = async () => {
      const store = getActiveNoteStore();
      if (!store) return;
      const { noteId, note } = store.getState();
      if (!noteId || !note) return;

      // Link the working note to a new drawer item id (also flushes the live document
      // and marks the note clean); the returned aggregate seeds the drawer item content.
      const newItemId = cuid();
      const aggregate = await store.getState().actions.linkToDrawerItem(newItemId);
      if (!aggregate) return;

      // Point any board tile referencing this (once tab-only) note at the new drawer item, so the reference
      // survives the save as a live drawer-backed reference (the note id is preserved, so no re-key needed).
      // Runs regardless of which tab is active - the Save is fired from the note tab, so the board tile's own
      // render effect can't do this.
      await stampNoteReferencesDrawerSource(noteId, newItemId);

      if (!isDrawerOpen) {
         setDrawerOpen(true);
      }

      // A note is game-agnostic -> a NEUTRAL drawer item; the naming window finalizes it.
      initiateItemDrop({
         game: 'NEUTRAL',
         type: 'NOTE',
         content: aggregate,
         defaultName: note.title,
         presetId: newItemId,
         parentFolderId: drawerCurrentFolderId ?? undefined,
      });
   };

   return { saveCharacterToDrawer, saveCharacterAsToDrawer, saveBoardToDrawer, saveBoardAsToDrawer, saveNoteToDrawer, saveNoteAsToDrawer };
}
