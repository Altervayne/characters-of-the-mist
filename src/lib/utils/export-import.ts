import type { Card, Tracker, Character } from '@/lib/types/character';
import type { Drawer, Folder, GameSystem, GeneralItemType } from '../types/drawer';
import { APP_VERSION } from '../config';

export type ExportableItemType = GeneralItemType
export type ExportableContent = Card | Tracker | Character | Folder | Drawer;

export interface ExportFile {
   fileType: ExportableItemType;
   game: GameSystem;
   version?: string;
   content: ExportableContent;
};

/**
 * Generates a nicely formatted filename for exported items.
 * Format: [Name]_[GameAbbrev]_[Type]_[Date].cotm
 * Example: "MyHero_LitM_Character_2025-01-15.cotm"
 */
export function generateExportFilename(game: GameSystem, type: ExportableItemType, customHandle?: string): string {
   const date = new Date().toISOString().slice(0, 10);
   let textType: string | undefined = undefined
   let textGame: string | undefined = undefined

   switch(game) {
      case "LEGENDS":
         textGame = "LitM"
         break;

      case "CITY_OF_MIST":
         textGame = "CoM"
         break;

      case "OTHERSCAPE":
         textGame = "OS"
         break;
   }

   switch(type) {
      case "FULL_CHARACTER_SHEET":
         textType = "Character"
         break;

      case "CHARACTER_CARD":
         textType = "Character-Card"
         break;

      case "CHARACTER_THEME":
         textType = "Theme-Card"
         break;

      case "GROUP_THEME":
         textType = "Group-Theme-Card"
         break;

      case "FOLDER":
         textType = "Drawer-Folder"
         break;
      
      case "FULL_DRAWER":
         textType = "Drawer"
         break;

      case "STATUS_TRACKER":
         textType = "Status-Tracker"
         break;

      case "STORY_TAG_TRACKER":
         textType = "Story-Tag-Tracker"
         break;

      case "STORY_THEME_TRACKER":
         textType = "Story-Theme-Tracker"
         break;
   }

   const baseName = textGame ? `${textGame}_${textType}` : textType;
   const prefix = customHandle ? `${customHandle}_${baseName}` : baseName;

   return `${prefix}_${date}`;
};

/**
 * Exports an item to a .cotm file and triggers the browser download.
 * Wraps the content in an ExportFile structure with metadata and version info.
 */
export function exportToFile(item: ExportableContent, type: ExportableItemType, game: GameSystem, fileName: string) {
   const exportData: ExportFile = {
      fileType: type,
      game: game,
      version: APP_VERSION,
      content: item,
   };

   const jsonString = JSON.stringify(exportData, null, 2);
   const blob = new Blob([jsonString], { type: 'application/json' });
   const url = URL.createObjectURL(blob);

   const a = document.createElement('a');
   a.href = url;
   a.download = `${fileName}.cotm`;
   document.body.appendChild(a);
   a.click();

   document.body.removeChild(a);
   URL.revokeObjectURL(url);
};

/**
 * Quick helper to export a full character sheet.
 * Generates the filename automatically from the character's name and game.
 */
export function exportCharacterSheet(character: Character) {
   const fileName = generateExportFilename(character.game, 'FULL_CHARACTER_SHEET', character.name);
   exportToFile(character, 'FULL_CHARACTER_SHEET', character.game, fileName);
};

/**
 * Exports the entire drawer - all your characters, folders, and components in one file.
 * Perfect for backups or transferring your whole collection to another device.
 */
export function exportDrawer(drawer: Drawer) {
   const today = new Date();
   const dd = String(today.getDate()).padStart(2, '0');
   const mm = String(today.getMonth() + 1).padStart(2, '0');
   const yyyy = today.getFullYear();

   const todayString = mm + '-' + dd + '-' + yyyy;
   const drawerFileName = 'Characters of the Mist - Full Drawer - ' + todayString

   exportToFile(drawer, 'FULL_DRAWER', 'NEUTRAL', drawerFileName);
};

/**
 * Imports a .cotm file and parses it into an ExportFile structure.
 * Returns a promise that resolves with the parsed data, or rejects if the file is invalid.
 * Validates the file format to make sure it's actually a CotM export.
 */
export function importFromFile(file: File): Promise<ExportFile> {
   return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
         try {
            const result = event.target?.result;
            if (typeof result !== 'string') {
               throw new Error('File could not be read as text.');
            }

            const parsedData = JSON.parse(result);

            if (!parsedData.fileType || !parsedData.content) {
               throw new Error('Invalid file format: Missing required properties.');
            }

            resolve(parsedData as ExportFile);
         } catch (error) {
            reject(error);
         }
      };

      reader.onerror = (error) => {
         reject(error);
      };

      reader.readAsText(file);
   });
};