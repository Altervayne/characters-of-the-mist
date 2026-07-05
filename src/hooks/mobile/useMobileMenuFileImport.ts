// -- React Imports --
import { useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Store Imports --
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { deriveDrawerFolderName, importFromFile } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { Drawer } from '@/lib/types/drawer';



/**
 * Owns the mobile menu's two file-import flows: importing a full character sheet
 * and importing a full drawer. Each flow has a hidden file input (whose ref this
 * hook provides), a change handler that parses the picked file and dispatches the
 * matching store action with a success/failure toast, and a trigger that opens
 * the picker.
 *
 * Both flows are intentionally full-file-only: the character flow accepts only a
 * FULL_CHARACTER_SHEET and the drawer flow only a FULL_DRAWER, rejecting anything
 * else - matching the menu's existing scope (loose card/tracker/folder imports
 * belong to the sheet and drawer surfaces, not the menu). This hook reuses the
 * shared `importFromFile`/`harmonizeData`/`deriveDrawerFolderName` utilities and
 * store actions as-is; it adds no logic of its own.
 *
 * @returns The two input refs to attach to the hidden file inputs, their change
 *   handlers, and the two trigger functions that open the pickers.
 */
export function useMobileMenuFileImport() {
   const { t } = useTranslation();
   const { mobileOpenCharacter } = useTabManagerActions();
   const { importDrawerAsFolder } = useDrawerActions();

   const characterImportInputRef = useRef<HTMLInputElement>(null);
   const drawerImportInputRef = useRef<HTMLInputElement>(null);

   const handleCharacterImportFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      try {
         const file = files[0];
         const importedData = await importFromFile(file);

         if (importedData.fileType === 'FULL_CHARACTER_SHEET') {
            const harmonized = harmonizeData(importedData.content, importedData.fileType);
            mobileOpenCharacter(harmonized as Character);
            toast.success(t('Notifications.character.imported'));
         } else {
            toast.error(t('Notifications.general.importFailed'));
         }

         if (characterImportInputRef.current) {
            characterImportInputRef.current.value = '';
         }
      } catch (error) {
         console.error('Import error:', error);
         toast.error(t('Notifications.general.importFailed'));
      }
   };

   const handleDrawerImportFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      try {
         const file = files[0];
         const importedData = await importFromFile(file);

         if (importedData.fileType === 'FULL_DRAWER') {
            // Harmonize before persisting, mirroring the character branch above and the desktop
            // drawer import - a 1.x drawer is migrated (tracker game strip + wrapper NEUTRAL, tag
            // upgrades) as the harmonizer recurses its tree.
            const migrated = harmonizeData(importedData.content, importedData.fileType);
            importDrawerAsFolder(migrated as Drawer, deriveDrawerFolderName(file.name, t('Drawer.importedDrawerDefaultName')));
            toast.success(t('Notifications.drawer.importedAsFolder'));
         } else {
            toast.error(t('Notifications.general.importFailed'));
         }

         // Reset file input
         if (drawerImportInputRef.current) {
            drawerImportInputRef.current.value = '';
         }
      } catch (error) {
         console.error('Import error:', error);
         toast.error(t('Notifications.general.importFailed'));
      }
   };

   const triggerCharacterImport = () => characterImportInputRef.current?.click();
   const triggerDrawerImport = () => drawerImportInputRef.current?.click();

   return {
      characterImportInputRef,
      drawerImportInputRef,
      handleCharacterImportFileSelected,
      handleDrawerImportFileSelected,
      triggerCharacterImport,
      triggerDrawerImport,
   };
}
