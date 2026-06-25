// -- React Imports --
import type React from 'react';
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { CornerUpRight, MoreHorizontal, Move, Pencil, Trash2 } from 'lucide-react';

// -- Utils Imports --
import { getItemTypeIcon } from '@/lib/utils/drawer-icons';
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { DrawerItemSummary } from '@/lib/drawer/drawerRepository';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * A flat search-result row, driven by a content-FREE {@link DrawerItemSummary}: the item's type glyph,
 * its name + game glyph, and its created/updated dates, with a menu for Jump-to-folder + rename / move /
 * delete (all id-based, so no content load). NON-draggable - intra-drawer reorder is off in results.
 */

/** Short, locale-aware date formatting for the created/updated lines. */
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** The game's glyph element (resolved in this module helper, not in render), or null for the neutral case. */
function gameGlyph(game: GameSystem): React.ReactElement | null {
   if (game === 'NEUTRAL') return null;
   const Icon = getGameVisual(game).Icon;
   return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

interface DrawerSearchResultEntryProps {
   summary: DrawerItemSummary;
   onJumpTo: () => void;
   onRename: () => void;
   onDelete: () => void;
   onMove: () => void;
}

export function DrawerSearchResultEntry({ summary, onJumpTo, onRename, onDelete, onMove }: DrawerSearchResultEntryProps) {
   const { t } = useTranslation();

   return (
      <div className="group/result relative flex items-center gap-2 rounded bg-card p-2 data-[state=open]:bg-muted hover:bg-muted">
         {getItemTypeIcon(summary.type)}

         <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
               <span className="truncate text-sm font-medium">{summary.name}</span>
               {gameGlyph(summary.game)}
            </div>
            <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
               <span>{t('Drawer.search.created', { date: dateFormatter.format(summary.createdAt) })}</span>
               <span>{t('Drawer.search.updated', { date: dateFormatter.format(summary.updatedAt) })}</span>
            </div>
         </div>

         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 cursor-pointer opacity-0 transition-opacity group-hover/result:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
               <DropdownMenuItem onClick={onJumpTo} className="cursor-pointer">
                  <CornerUpRight className="mr-2 h-4 w-4" />
                  <span>{t('Drawer.search.jumpTo')}</span>
               </DropdownMenuItem>
               <DropdownMenuItem onClick={onRename} className="cursor-pointer">
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>{t('Drawer.Actions.rename')}</span>
               </DropdownMenuItem>
               <DropdownMenuItem onClick={onMove} className="cursor-pointer">
                  <Move className="mr-2 h-4 w-4" />
                  <span>{t('Drawer.Actions.move')}</span>
               </DropdownMenuItem>
               <DropdownMenuItem onClick={onDelete} className="cursor-pointer bg-destructive text-destructive-foreground">
                  <Trash2 className="mr-2 h-4 w-4 text-destructive-foreground" />
                  <span>{t('Drawer.Actions.delete')}</span>
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}
