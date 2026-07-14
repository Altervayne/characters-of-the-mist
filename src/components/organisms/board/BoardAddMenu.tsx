// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ChevronDown, Plus } from 'lucide-react';

// -- Utils Imports --
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';

// -- Constant Imports --
import { CREATION_TAXONOMY } from '@/lib/creation/creationTaxonomy';
import { CREATABLE_BY_KIND } from '@/lib/creation/creatableRegistry';
import { GAME_CARD_OPTIONS, GAME_VISUALS } from '@/lib/constants/gameVisuals';

// -- Component Imports --
import {
   DropdownMenu,
   DropdownMenuTrigger,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuSub,
   DropdownMenuSubTrigger,
   DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

// -- Type Imports --
import type { CreatableKind } from '@/lib/creation/creatableRegistry';
import type { TrackerType } from '@/lib/trackers/emptyTracker';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The board toolbar's single "Create Element" popover: a tokened Radix menu offering every creatable element,
 * grouped into the three flat sections of `CREATION_TAXONOMY` (Basic / Rich / Game). It replaces
 * the flat spawn-icon row and the separate game-element dropdown with one button, so the bar carries a
 * single creation affordance and the popover + the radial read the same catalog. Board-furniture leaves
 * drop at the view center; a picker-first kind (a portal) opens its target picker; the Game rows keep
 * their existing handlers (a card first opens the creation form, as the radial does).
 */

interface BoardAddMenuProps {
   onAddItem: (kind: CreatableKind) => void;
   onOpenPortalPicker: () => void;
   onAddTracker: (trackerType: TrackerType) => void;
   onPickCardGame: (game: GameSystem) => void;
   onAddChallenge: () => void;
}

export function BoardAddMenu({ onAddItem, onOpenPortalPicker, onAddTracker, onPickCardGame, onAddChallenge }: BoardAddMenuProps) {
   const { t } = useTranslation();

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <button
               type="button"
               title={t('BoardView.addElement')}
               aria-label={t('BoardView.addElement')}
               className="flex shrink-0 items-center gap-1.5 rounded px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted cursor-pointer"
            >
               <Plus className="h-4 w-4" />
               <span className="whitespace-nowrap">{t('BoardView.addElement')}</span>
               <ChevronDown className="h-4 w-4" />
            </button>
         </DropdownMenuTrigger>
         <DropdownMenuContent side="bottom" align="start">
            {CREATION_TAXONOMY.map((group, index) => (
               <div key={group.key}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-muted-foreground">{t(group.labelKey)}</DropdownMenuLabel>

                  {/* Board furniture: one leaf per registry kind; a picker-first kind opens its picker. */}
                  {group.key !== 'game' &&
                     group.kinds.map((kind) => {
                        const { icon: Icon, labelKey, requiresPicker } = CREATABLE_BY_KIND[kind];
                        return (
                           <DropdownMenuItem
                              key={kind}
                              className="gap-2"
                              onSelect={() => (requiresPicker ? onOpenPortalPicker() : onAddItem(kind))}
                           >
                              <Icon className="size-4" />
                              <span>{t(`BoardView.${labelKey}`)}</span>
                           </DropdownMenuItem>
                        );
                     })}

                  {/* Game elements: trackers + cards open sub-branches; a challenge drops immediately. */}
                  {group.key === 'game' &&
                     group.rows.map((row) => {
                        const RowIcon = row.icon;
                        if (row.kind === 'trackers') {
                           return (
                              <DropdownMenuSub key={row.kind}>
                                 <DropdownMenuSubTrigger className="gap-2">
                                    <RowIcon className="size-4" />
                                    <span>{t(row.labelKey)}</span>
                                 </DropdownMenuSubTrigger>
                                 <DropdownMenuSubContent>
                                    {row.rows.map(({ id, trackerType, itemType, labelKey }) => {
                                       const Icon = getItemTypeIconComponent(itemType);
                                       return (
                                          <DropdownMenuItem key={id} className="gap-2" onSelect={() => onAddTracker(trackerType)}>
                                             <Icon />
                                             <span>{t(labelKey)}</span>
                                          </DropdownMenuItem>
                                       );
                                    })}
                                 </DropdownMenuSubContent>
                              </DropdownMenuSub>
                           );
                        }
                        if (row.kind === 'cards') {
                           return (
                              <DropdownMenuSub key={row.kind}>
                                 <DropdownMenuSubTrigger className="gap-2">
                                    <RowIcon className="size-4" />
                                    <span>{t(row.labelKey)}</span>
                                 </DropdownMenuSubTrigger>
                                 <DropdownMenuSubContent>
                                    {GAME_CARD_OPTIONS.map(({ game }) => {
                                       const { Icon } = GAME_VISUALS[game];
                                       return (
                                          <DropdownMenuItem key={game} className="gap-2" onSelect={() => onPickCardGame(game)}>
                                             <Icon />
                                             <span>{t(`Drawer.Types.${game}`)}</span>
                                          </DropdownMenuItem>
                                       );
                                    })}
                                 </DropdownMenuSubContent>
                              </DropdownMenuSub>
                           );
                        }
                        return (
                           <DropdownMenuItem key={row.kind} className="gap-2" onSelect={onAddChallenge}>
                              <RowIcon className="size-4" />
                              <span>{t(row.labelKey)}</span>
                           </DropdownMenuItem>
                        );
                     })}
               </div>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
