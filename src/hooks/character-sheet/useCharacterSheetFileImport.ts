// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

// -- Utils Imports --
import { importFromFile } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';
import { importBoard } from '@/lib/board/boardRepository';
import { prepareImportedBoard } from '@/lib/board/importBoardReferencedCharacters';
import { useThemeImport } from '@/lib/theme/useThemeImport';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';
import type { Board } from '@/lib/types/board';



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
   const { addImportedCard, addImportedTracker } = useCharacterActions();
   const { openCharacterTab, openBoardTab } = useTabManagerActions();
   const { setContextualGame } = useAppSettingsActions();
   const { reloadCurrentFolder } = useDrawerActions();
   const importTheme = useThemeImport();

   const onFileDrop = useCallback(async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);
         const { fileType, game } = importedData;

         // ==================
         //  Full character sheet
         // ==================
         if (fileType === 'FULL_CHARACTER_SHEET') {
            const characterData = migratedContent as Character;
            openCharacterTab(characterData);
            setContextualGame(characterData.game);
            toast.success(tNotifications('Notifications.character.imported'));
            return;
         }

         // ==================
         //  Full board (character-independent; always imported as a NEW board)
         // ==================
         if (fileType === 'FULL_BOARD') {
            const board = migratedContent as Board;
            // Rehydrate the board's referenced characters (link existing / recreate absent, ids kept),
            // re-id for a fresh independent copy, then rewire the elements to the local characters.
            const prepared = await prepareImportedBoard(
               board,
               importedData.embedded,
               tNotifications('Drawer.importedFromBoardFolder', { board: board.name }),
            );
            await importBoard(prepared);
            // The import may have written an "Imported from {board}" folder straight to the DB;
            // re-read the current view so it shows without an app reload (a no-op on a pure link).
            await reloadCurrentFolder();
            await openBoardTab(prepared.id);
            toast.success(tNotifications('Notifications.board.imported'));
            return;
         }

         // ==================
         //  Custom theme (character-independent; always imported as a NEW custom and selected)
         // ==================
         if (fileType === 'CUSTOM_THEME') {
            importTheme(importedData);
            return;
         }

         // ==================
         //  Individual components require a character to be loaded
         // ==================
         if (!character) {
            toast.error(tNotifications('Notifications.general.importFailedNoCharacter'));
            return;
         }

         // ==================
         //  Compatibility check for individual components
         // ==================
         // NEUTRAL items are game-agnostic, so they import onto any character.
         if (game !== 'NEUTRAL' && game !== character.game) {
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
   }, [character, openCharacterTab, openBoardTab, addImportedCard, addImportedTracker, setContextualGame, reloadCurrentFolder, importTheme, tNotifications]);

   const { getRootProps, isDragActive } = useDropzone({
      onDrop: onFileDrop,
      noClick: true,
      noKeyboard: true,
      accept: { 'application/json': ['.cotm', '.json'] },
   });

   return { getRootProps, isDragActive };
}
