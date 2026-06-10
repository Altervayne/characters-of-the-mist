// -- React Imports --
import React from 'react';

// -- Component Imports --
import { LegendsThemeCard } from '@/components/organisms/cards/LegendsThemeCard';
import { CityThemeCard } from '@/components/organisms/cards/CityThemeCard';
import { OtherscapeThemeCard } from '@/components/organisms/cards/OtherscapeThemeCard';
import { HeroCard } from '@/components/organisms/cards/HeroCard';
import { RiftCard } from '@/components/organisms/cards/RiftCard';
import { OtherscapeCharacterCard } from '@/components/organisms/cards/OtherscapeCharacterCard';

// -- Type Imports --
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { Card as CardData } from '@/lib/types/character';



interface CardRendererProps {
   card: CardData;
   isEditing: boolean;
   isSnapshot?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onEditCard?: () => void;
   onExport?: () => void;
}

export const CardRenderer = React.memo(
   React.forwardRef<HTMLDivElement, CardRendererProps>(
     ({ card, isEditing, isSnapshot, dragAttributes, dragListeners, onEditCard, onExport }, ref) => {
         const commonProps = { ref, isEditing, isSnapshot, dragAttributes, dragListeners, onEditCard, onExport };

         if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME' || card.cardType === 'LOADOUT_THEME') {
            if (card.details.game === 'LEGENDS') {
               return <LegendsThemeCard card={card} {...commonProps} />;
            } else if (card.details.game === 'CITY_OF_MIST') {
               return <CityThemeCard card={card} {...commonProps} />;
            } else if (card.details.game === 'OTHERSCAPE') {
               return <OtherscapeThemeCard card={card} {...commonProps} />;
            }
         }
         if (card.cardType === 'CHARACTER_CARD') {
            if (card.details.game === 'LEGENDS') {
               return <HeroCard card={card} {...commonProps} />;
            } else if (card.details.game === 'CITY_OF_MIST') {
               return <RiftCard card={card} {...commonProps} />;
            } else if (card.details.game === 'OTHERSCAPE') {
               return <OtherscapeCharacterCard card={card} {...commonProps} />;
            }
         }

         return <div ref={ref} className="h-75 w-62.5 bg-card overflow-hidden text-card-foreground border-2 rounded-lg flex items-center justify-center">
                  <p className='w-full text-wrap text-center'>{`NO RENDER AVAILABLE FOR THIS TYPE: ${card.details.game} ${card.cardType}`}</p>
               </div>;
   })
);
CardRenderer.displayName = 'CardRenderer';
