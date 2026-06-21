// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Utils Imports --
import { mapItemToStorableInfo } from '@/lib/utils/dnd';
import { deriveExportHandle, generateExportFilename, exportToFile } from '@/lib/utils/export-import';

// -- Type Imports --
import type { Card as CardData, Tracker } from '@/lib/types/character';



/**
 * Provides the export handler for character-sheet cards and trackers.
 *
 * Resolves the item's storable type and game system, derives a human-readable
 * filename handle (via `deriveExportHandle`), and triggers a .cotm download -
 * surfacing a toast on success or when the item type cannot be exported.
 *
 * @returns `handleExportComponent` - the callback passed to each card and
 *   tracker for its export action.
 */
export function useCharacterSheetExport() {
   const { t: tNotifications } = useTranslation();

   const handleExportComponent = async (item: CardData | Tracker) => {
      const storableInfo = mapItemToStorableInfo(item);

      if (!storableInfo) {
         toast.error(tNotifications('Notifications.general.invalidExportType'));
         return;
      }

      const [itemType, gameSystem] = storableInfo;
      const handle = deriveExportHandle(item, 'title' in item ? item.title : item.name);

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
