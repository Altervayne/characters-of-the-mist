'use client';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Basic UI Imports --
import { Card as CardComponent } from '@/components/ui/card';

// -- Icon Imports --
import { Package, CreditCard, File } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import { Character } from '@/lib/types/character';
import { DrawerItem } from '@/lib/types/drawer';



interface CharacterSheetPreviewProps {
   item: DrawerItem;
}

type CharacterCardThemes = 'card-type-hero' | 'card-type-character-com' | 'card-type-character-otherscape'



export const CharacterSheetPreview = ({ item }: CharacterSheetPreviewProps) => {
   const t = useTranslations('Drawer.Types');

   const character = item.content as Character;
   const type = `${character.game}_FULL_CHARACTER_SHEET`

   let cardThemeClass: CharacterCardThemes
   switch(character.game) {
      case 'LEGENDS':
         cardThemeClass = "card-type-hero"
         break;

      case 'CITY_OF_MIST':
         cardThemeClass = "card-type-character-com"
         break;

      case 'OTHERSCAPE':
         cardThemeClass = "card-type-character-otherscape"
         break;

      default:
         cardThemeClass = "card-type-hero"
   }

   if (!character) {
      return null;
   }
   
   const cardCount = character.cards.length;
   const trackerCount = character.trackers.statuses.length + character.trackers.storyTags.length;

   return (
      <CardComponent
         className={cn(
            cardThemeClass,
            "w-[250px] h-[120px] flex flex-col p-0 justify-between overflow-hidden gap-1",
            "border-2 border-card-border shadow-lg bg-card-paper-bg text-card-foreground"
         )}
      >
         <header className="flex items-center p-2 gap-2 bg-card-header-bg pb-1 border-b border-card-accent">
            <Package className="h-5 w-5 text-card-header-fg" />
            <h3 className="font-bold text-sm text-card-header-fg">{t(type)}</h3>
         </header>
         
         <div className="flex flex-col p-2 justify-center items-center flex-grow pl-1">
            <p className="text-md text-card-paper-fg font-bold truncate leading-tight">
               {character.name || "Unnamed Character"}
            </p>
         </div>
         
         <footer className="flex items-center p-2 gap-4 pt-1 border-t border-card-accent bg-card-popover-bg">
            <div className="flex items-center gap-1.5 text-xs text-card-popover-fg">
               <File className="h-4 w-4" />
               <span>{cardCount} {t('cards')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-card-popover-fg">
               <CreditCard className="h-4 w-4" />
               <span>{trackerCount} {t('trackers')}</span>
            </div>
         </footer>
      </CardComponent>
   );
};