// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Drawer Imports --
import { formatAbsoluteItemDate, formatRelativeItemDate, itemDateMode } from '@/lib/drawer/itemDateDisplay';

// -- Type Imports --
import type { GeneralItemType } from '@/lib/types/drawer';

/*
 * One date line for a drawer item, shared by the Rich card, the List row, and the search result row.
 * Re-saveable types (character sheet / board) read "Updated <relative>" with both absolute dates on
 * hover; write-once types read "Created <relative>" with the absolute created on hover. Renders nothing
 * when the item carries no dates (a nested item from the drag overlay / mobile, which lack them).
 */

interface ItemDateLabelProps {
   type: GeneralItemType;
   createdAt?: number;
   updatedAt?: number;
   className?: string;
}

export function ItemDateLabel({ type, createdAt, updatedAt, className }: ItemDateLabelProps) {
   const { t } = useTranslation();
   if (createdAt === undefined) return null;

   const mode = itemDateMode(type);
   const stamp = mode === 'updated' ? updatedAt ?? createdAt : createdAt;

   // Hover title: re-saveable shows created + updated absolutes; write-once shows the created absolute.
   const title = mode === 'updated'
      ? `${t('Drawer.search.created', { date: formatAbsoluteItemDate(createdAt) })} · ${t('Drawer.search.updated', { date: formatAbsoluteItemDate(updatedAt ?? createdAt) })}`
      : t('Drawer.search.created', { date: formatAbsoluteItemDate(createdAt) });

   return (
      <span title={title} className={className}>
         {t(`Drawer.card.${mode}`, { relative: formatRelativeItemDate(stamp) })}
      </span>
   );
}
