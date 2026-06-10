// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

// -- Utils Imports --
import { importFromFile } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';



/**
 * Wires the character sheet's file-drop import zone.
 *
 * Accepts dropped .cotm/.json files, parses and harmonizes them, then dispatches
 * to the correct store action: a full character sheet replaces the loaded
 * character, while an individual card or tracker is imported into the current
 * character (after validating that a character is loaded and its game matches).
 * Uses react-dropzone configured for drop-only interaction (no click, no
 * keyboard).
 *
 * @returns The dropzone root props for the drop container and the active-drag
 *   flag used to render the drop overlay.
 */
export function useCharacterSheetFileImport() {
   const { t: tNotifications } = useTranslation();
   const character = useCharacterStore((state) => state.character);
   const { loadCharacter, addImportedCard, addImportedTracker } = useCharacterActions();
   const { setContextualGame } = useAppSettingsActions();

   const onFileDrop = useCallback(async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);
         const { fileType, game } = importedData;

         // --- Full character sheet ---
         if (fileType === 'FULL_CHARACTER_SHEET') {
            const characterData = migratedContent as Character;
            loadCharacter(characterData);
            setContextualGame(characterData.game);
            toast.success(tNotifications('Notifications.character.imported'));
            return;
         }

         // --- Individual components require a character to be loaded ---
         if (!character) {
            toast.error(tNotifications('Notifications.general.importFailedNoCharacter'));
            return;
         }

         // --- Compatibility check for individual components ---
         if (game !== character.game) {
            toast.error(tNotifications('Notifications.general.importFailedWrongGame'));
            return;
         }

         const isCardType = fileType === 'CHARACTER_CARD' || fileType === 'CHARACTER_THEME' || fileType === 'GROUP_THEME' || fileType === 'LOADOUT_THEME';
         const isTrackerType = fileType === 'STATUS_TRACKER' || fileType === 'STORY_TAG_TRACKER' || fileType === 'STORY_THEME_TRACKER';

         if (isCardType) {
            addImportedCard(migratedContent as CardData);
            toast.success(tNotifications('Notifications.character.componentImported'));
         } else if (isTrackerType) {
            addImportedTracker(migratedContent as Tracker);
            toast.success(tNotifications('Notifications.character.componentImported'));
         } else {
            toast.error(tNotifications('Notifications.general.importFailed'));
         }

      } catch (error) {
         console.error("Failed to import file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
   }, [character, loadCharacter, addImportedCard, addImportedTracker, setContextualGame, tNotifications]);

   const { getRootProps, isDragActive } = useDropzone({
      onDrop: onFileDrop,
      noClick: true,
      noKeyboard: true,
      accept: { 'application/json': ['.cotm', '.json'] },
   });

   return { getRootProps, isDragActive };
}
