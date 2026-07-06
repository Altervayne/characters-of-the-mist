// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Utils Imports --
import { mapItemToStorableInfo } from '@/lib/utils/dnd';
import { deriveExportHandle, generateExportFilename, exportToFile } from '@/lib/utils/export-import';

// -- Type Imports --
import type { Card as CardData, Tracker } from '@/lib/types/character';
import type { Journal } from '@/lib/types/board';



/**
 * The filename handle for an item: a card by its title / theme name (via `deriveExportHandle`), a
 * tracker by its name, a journal by the first line of its first page. A blank journal falls back to
 * a generic label so the file never lands nameless (`generateExportFilename` still dates it).
 */
export function exportHandleFor(item: CardData | Tracker | Journal, fallbackJournalName: string): string | undefined {
   if ('pages' in item) {
      const firstLine = (item.pages[0]?.text ?? '').split('\n')[0].trim();
      return firstLine || fallbackJournalName;
   }
   return deriveExportHandle(item, 'title' in item ? item.title : item.name);
}

/**
 * Provides the export handler for character-sheet cards, trackers, and journals.
 *
 * Resolves the item's storable type and game system, derives a human-readable
 * filename handle, and triggers a .cotm download - surfacing a toast on success
 * or when the item type cannot be exported. A journal exports as JOURNAL/NEUTRAL
 * (plain markdown text, no image assets to embed).
 *
 * @returns `handleExportComponent` - the callback passed to each card, tracker,
 *   and journal for its export action.
 */
export function useCharacterSheetExport() {
   const { t: tNotifications } = useTranslation();

   const handleExportComponent = async (item: CardData | Tracker | Journal) => {
      const storableInfo = mapItemToStorableInfo(item);

      if (!storableInfo) {
         toast.error(tNotifications('Notifications.general.invalidExportType'));
         return;
      }

      const [itemType, gameSystem] = storableInfo;
      const handle = exportHandleFor(item, tNotifications('Cards.journal.untitled'));

      const fileName = generateExportFilename(gameSystem, itemType, handle);
      try {
         await exportToFile(item, itemType, gameSystem, fileName);
         toast.success(tNotifications('Notifications.general.exportSuccess'));
      } catch {
         toast.error(tNotifications('Notifications.general.exportError'));
      }
   };

   return { handleExportComponent };
}
