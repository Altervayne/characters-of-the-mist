// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ChevronDown, LayoutGrid, ListChecks, Skull } from 'lucide-react';

// -- Utils Imports --
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';

// -- Constant Imports --
import { GAME_CARD_OPTIONS, GAME_VISUALS } from '@/lib/constants/gameVisuals';

// -- Component Imports --
import {
   DropdownMenu,
   DropdownMenuTrigger,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSub,
   DropdownMenuSubTrigger,
   DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

// -- Type Imports --
import type { TrackerType } from '@/lib/trackers/emptyTracker';
import type { GameSystem, GeneralItemType } from '@/lib/types/drawer';

/*
 * The board toolbar's "Other Elements..." dropdown: a tokened Radix menu anchored to its own button
 * (never the radial - the radial stays the right-click affordance). It offers the GAME / CHARACTER
 * content the radial's "sheet elements" branch offers beyond the board furniture - trackers, cards by
 * game, and a challenge - so a board can host sheet-flavored pieces without the drawer. Icons + labels
 * mirror the radial's sources (drawer-icon glyphs + game visuals) so the two can't drift. Each leaf
 * creates its element at the view center (a card first opens the creation form, as the radial does).
 */

/** The tracker rows, mirroring the radial's `RADIAL_TRACKERS` (drawer glyph + label per tracker type). */
const TRACKER_ROWS: { id: string; trackerType: TrackerType; itemType: GeneralItemType; labelKey: string }[] = [
   { id: 'status', trackerType: 'STATUS', itemType: 'STATUS_TRACKER', labelKey: 'Trackers.addStatus' },
   { id: 'story-tag', trackerType: 'STORY_TAG', itemType: 'STORY_TAG_TRACKER', labelKey: 'Trackers.addStoryTag' },
   { id: 'story-theme', trackerType: 'STORY_THEME', itemType: 'STORY_THEME_TRACKER', labelKey: 'Trackers.addStoryTheme' },
];

interface BoardAddGameElementMenuProps {
   onAddTracker: (trackerType: TrackerType) => void;
   onPickCardGame: (game: GameSystem) => void;
   onAddChallenge: () => void;
}

export function BoardAddGameElementMenu({ onAddTracker, onPickCardGame, onAddChallenge }: BoardAddGameElementMenuProps) {
   const { t } = useTranslation();

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <button
               type="button"
               title={t('BoardView.otherElements')}
               aria-label={t('BoardView.otherElements')}
               className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer"
            >
               <span className="whitespace-nowrap">{t('BoardView.otherElements')}</span>
               <ChevronDown className="h-4 w-4" />
            </button>
         </DropdownMenuTrigger>
         <DropdownMenuContent side="bottom" align="start">
            {/* Trackers: a sub-ring in the radial, a submenu here (three tracker kinds). */}
            <DropdownMenuSub>
               <DropdownMenuSubTrigger className="gap-2">
                  <ListChecks className="size-4" />
                  <span>{t('BoardView.radialTrackers')}</span>
               </DropdownMenuSubTrigger>
               <DropdownMenuSubContent>
                  {TRACKER_ROWS.map(({ id, trackerType, itemType, labelKey }) => {
                     const Icon = getItemTypeIconComponent(itemType);
                     return (
                        <DropdownMenuItem key={id} onSelect={() => onAddTracker(trackerType)}>
                           <Icon />
                           <span>{t(labelKey)}</span>
                        </DropdownMenuItem>
                     );
                  })}
               </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Cards: by game, mirroring the radial. A leaf opens the creation form (theme wizardry). */}
            <DropdownMenuSub>
               <DropdownMenuSubTrigger className="gap-2">
                  <LayoutGrid className="size-4" />
                  <span>{t('BoardView.radialCards')}</span>
               </DropdownMenuSubTrigger>
               <DropdownMenuSubContent>
                  {GAME_CARD_OPTIONS.map(({ game }) => {
                     const { Icon } = GAME_VISUALS[game];
                     return (
                        <DropdownMenuItem key={game} onSelect={() => onPickCardGame(game)}>
                           <Icon />
                           <span>{t(`Drawer.Types.${game}`)}</span>
                        </DropdownMenuItem>
                     );
                  })}
               </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Challenge: a peer leaf (always LEGENDS-flavored, no form), drops immediately. */}
            <DropdownMenuItem onSelect={onAddChallenge}>
               <Skull />
               <span>{t('BoardView.addChallenge')}</span>
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
