// -- React Imports --
import React from 'react';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';

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

         const ResolvedCard = resolveCardComponent(card.cardType, card.details.game);
         if (ResolvedCard) {
            // `react-hooks/static-components` flags rendering a component held in a
            // local binding, assuming it was created during render (which would
            // reset its state on every render). That is a FALSE POSITIVE here:
            // resolveCardComponent returns one of six stable, module-level card
            // organisms - it never constructs a component - so the resolved type is
            // referentially stable across renders and carries no state-reset risk.
            // The ref is forwarded for drag-and-drop, exactly as the previous static
            // branches did. If a future React Compiler version learns to see through
            // this indirection, remove the disable.
            // eslint-disable-next-line react-hooks/static-components
            return <ResolvedCard card={card} {...commonProps} />;
         }

         return <div ref={ref} className="h-75 w-62.5 bg-card overflow-hidden text-card-foreground border-2 rounded-lg flex items-center justify-center">
                  <p className='w-full text-wrap text-center'>{`NO RENDER AVAILABLE FOR THIS TYPE: ${card.details.game} ${card.cardType}`}</p>
               </div>;
   })
);
CardRenderer.displayName = 'CardRenderer';
