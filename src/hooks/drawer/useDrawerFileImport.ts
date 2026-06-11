// -- React Imports --
import { useRef, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

// -- Utils Imports --
import { exportDrawer, importFromFile } from '@/lib/utils/export-import';

// -- Store Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';

// -- Type Imports --
import type { Folder as FolderType, DrawerItemContent, Drawer as DrawerType } from '@/lib/types/drawer';



/**
 * Owns the Drawer's file import and export.
 *
 * Handles dropped or picked .cotm/.json files: a full drawer replaces the
 * current drawer, while a folder or item is imported into the currently open
 * folder. Exposes react-dropzone root props for the drag-and-drop zone, a change
 * handler for the hidden file input (which it resets via `formRef` after a pick),
 * and a full-drawer export handler. Owns `fileInputRef` (bound to the hidden file
 * input and triggered by the import button) so the file-picker ref is dedicated
 * to the import flow and never shared with the modification-window input.
 *
 * @param currentFolderId - The currently open folder, used as the import
 *   destination for imported folders and items.
 * @returns The dropzone root props and active-drag flag, the file-input change
 *   and drawer-export handlers, and the form/file-input refs bound to the hidden
 *   import form and its file input.
 */
export function useDrawerFileImport(currentFolderId: string | null) {
   const { t: tNotifications } = useTranslation();
   const { importFullDrawer, addImportedFolder, addImportedItem } = useDrawerActions();

   const formRef = useRef<HTMLFormElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const processFile = useCallback(async (file?: File) => {
      if (!file) return;

      try {
         const importedData = await importFromFile(file);

         switch (importedData.fileType) {
            case 'FULL_DRAWER':
               importFullDrawer(importedData.content as DrawerType);
               break;

            case 'FOLDER':
               addImportedFolder(importedData.content as FolderType, currentFolderId ?? undefined);
               break;

            default:
               addImportedItem(importedData.content as DrawerItemContent, importedData.fileType, importedData.game, currentFolderId ?? undefined);
               break;
         }

         toast.success(tNotifications('Notifications.drawer.importSuccess'));

      } catch (error) {
         toast.error(tNotifications('Notifications.general.importFailed'));
         console.error("Failed to import file:", error);
      }
   }, [currentFolderId, addImportedFolder, addImportedItem, importFullDrawer, tNotifications]);

   const onDrop = useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
         processFile(acceptedFiles[0]);
      }
   }, [processFile]);

   const { getRootProps, isDragActive } = useDropzone({
      onDrop,
      noClick: true,
      noKeyboard: true,
      accept: {
         'application/json': ['.cotm', '.json'],
      },
   });

   const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      processFile(file);
      formRef.current?.reset();
   };

   const handleExportDrawer = () => {
      const drawerState = useDrawerStore.getState().drawer;
      exportDrawer(drawerState);
      toast.success(tNotifications('Notifications.drawer.exported'));
   };

   return { getRootProps, isDragActive, handleFileSelected, handleExportDrawer, formRef, fileInputRef };
}
