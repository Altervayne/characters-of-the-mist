// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Card as CardComponent } from '@/components/ui/card';

// -- Icon Imports --
import { File, CreditCard, User } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getGameSystemIcon } from '@/lib/utils/game-icons';

// -- Store and Hook Imports --
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Board Imports --
import { characterPortraitAssetId, overviewPanelCardClass, trackerCounts } from '@/lib/board/characterOverview';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { DrawerItem } from '@/lib/types/drawer';

/*
 * The drawer's rich preview for a saved character: portrait-left so a character reads as a face, not a
 * label. It mirrors the board element's identity header (game-themed header with the game glyph + name,
 * a square portrait, the same `User` fallback) but carries NO theme rows - the drawer item stays small.
 * The name is a fixed-height 2-line clamp, so the footprint is identical for a 3-char name and a long
 * epithet (it never grows the drawer). Game CONTENT, so it wears the game card-theme palette.
 */

interface CharacterSheetPreviewProps {
   item: DrawerItem;
}

export const CharacterSheetPreview = ({ item }: CharacterSheetPreviewProps) => {
   const { t } = useTranslation();

   const character = item.content as Character;
   const portrait = useAssetObjectUrl(characterPortraitAssetId(character));

   if (!character) {
      return null;
   }

   const cardCount = character.cards.length;
   const trackerCount = trackerCounts(character).total;

   return (
      <CardComponent
         className={cn(
            overviewPanelCardClass(character.game),
            'w-62.5 h-25 flex flex-col p-0 justify-between overflow-hidden gap-0',
            'border-2 border-card-border shadow-lg bg-card-paper-bg text-card-paper-fg',
         )}
      >
         {/* Themed header: the game glyph + the game name (same glyph the board uses). */}
         <header className="flex shrink-0 items-center gap-2 border-b border-card-accent bg-card-header-bg p-2 text-card-header-fg">
            {getGameSystemIcon(character.game)}
            <h3 className="truncate text-sm font-bold">{t(`Drawer.Types.${character.game}`)}</h3>
         </header>

         {/* Portrait-left body: the portrait sets the row height, so a 1- or 2-line name lands the same. */}
         <div className="flex min-h-0 flex-1 items-center gap-2 p-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-card-accent bg-card-paper-bg">
               {portrait.url
                  ? <img src={portrait.url} alt="" className="h-full w-full object-cover" />
                  : <User className="h-6 w-6 text-card-paper-fg/50" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
               {/* Fixed-height 2-line clamp + full name on hover, so a long name never grows the card. */}
               <p title={character.name} className="line-clamp-2 text-sm font-bold leading-tight">
                  {character.name || 'Unnamed Character'}
               </p>
               <div className="flex items-center gap-3 text-xs text-card-paper-fg/70">
                  <span className="flex items-center gap-1">
                     <File className="h-3.5 w-3.5" />
                     {cardCount} {t('Drawer.Types.cards')}
                  </span>
                  <span className="flex items-center gap-1">
                     <CreditCard className="h-3.5 w-3.5" />
                     {trackerCount} {t('Drawer.Types.trackers')}
                  </span>
               </div>
            </div>
         </div>
      </CardComponent>
   );
};
