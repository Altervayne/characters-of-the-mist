// -- Component Imports --
import { DrawerListRow } from '@/components/molecules/drawer/DrawerListRow';
import { DrawerResultMenu } from '@/components/molecules/drawer/DrawerResultMenu';

// -- Type Imports --
import type { DrawerItemSummary } from '@/lib/drawer/drawerRepository';

/*
 * A flat search-result row, driven by a content-FREE {@link DrawerItemSummary}. Shares the exact List
 * layout with the browse row ({@link DrawerListRow}) - type glyph, flexible name, game glyph, right-
 * aligned date column - but has NO drag grip (results aren't draggable); its menu adds Jump-to-folder.
 */

export interface DrawerSearchResultEntryProps {
   summary: DrawerItemSummary;
   onJumpTo: () => void;
   onRename: () => void;
   onDelete: () => void;
   onMove: () => void;
}

export function DrawerSearchResultEntry({ summary, onJumpTo, onRename, onDelete, onMove }: DrawerSearchResultEntryProps) {
   return (
      <DrawerListRow
         type={summary.type}
         name={summary.name}
         game={summary.game}
         createdAt={summary.createdAt}
         updatedAt={summary.updatedAt}
         trailing={
            <DrawerResultMenu
               onJumpTo={onJumpTo}
               onRename={onRename}
               onMove={onMove}
               onDelete={onDelete}
               triggerClassName="opacity-0 transition-opacity group-hover/row:opacity-100"
            />
         }
      />
   );
}
