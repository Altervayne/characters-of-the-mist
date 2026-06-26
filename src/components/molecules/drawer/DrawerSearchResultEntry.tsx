// -- React Imports --
import type React from 'react';

// -- Utils Imports --
import { getItemTypeIcon } from '@/lib/utils/drawer-icons';
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Component Imports --
import { ItemDateLabel } from '@/components/molecules/drawer/ItemDateLabel';
import { DrawerResultMenu } from '@/components/molecules/drawer/DrawerResultMenu';

// -- Type Imports --
import type { DrawerItemSummary } from '@/lib/drawer/drawerRepository';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * A flat search-result row, driven by a content-FREE {@link DrawerItemSummary}: the item's type glyph,
 * its name + game glyph, and the shared item date label, with a menu for Jump-to-folder + rename /
 * move / delete (all id-based, so no content load). NON-draggable - intra-drawer reorder is off here.
 */

/** The game's glyph element (resolved in this module helper, not in render), or null for the neutral case. */
function gameGlyph(game: GameSystem): React.ReactElement | null {
   if (game === 'NEUTRAL') return null;
   const Icon = getGameVisual(game).Icon;
   return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

export interface DrawerSearchResultEntryProps {
   summary: DrawerItemSummary;
   onJumpTo: () => void;
   onRename: () => void;
   onDelete: () => void;
   onMove: () => void;
}

export function DrawerSearchResultEntry({ summary, onJumpTo, onRename, onDelete, onMove }: DrawerSearchResultEntryProps) {
   return (
      <div className="group/result relative flex items-center gap-2 rounded bg-card p-2 data-[state=open]:bg-muted hover:bg-muted">
         {getItemTypeIcon(summary.type)}

         <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
               <span className="truncate text-sm font-medium">{summary.name}</span>
               {gameGlyph(summary.game)}
            </div>
            <ItemDateLabel type={summary.type} createdAt={summary.createdAt} updatedAt={summary.updatedAt} className="text-[11px] text-muted-foreground" />
         </div>

         <DrawerResultMenu
            onJumpTo={onJumpTo}
            onRename={onRename}
            onMove={onMove}
            onDelete={onDelete}
            triggerClassName="opacity-0 transition-opacity group-hover/result:opacity-100"
         />
      </div>
   );
}
