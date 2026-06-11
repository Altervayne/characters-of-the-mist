// -- Other Library Imports --
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- DnD Component Imports --
import { Sortable, DragLayoutWrapper } from '@/components/dnd';

// -- Component Imports --
import { CardRenderer } from '@/components/organisms/cards/CardRenderer';
import { AddCardButton } from '@/components/molecules/AddThemeCardButton';

// -- Type Imports --
import type { Character, Card as CardData } from '@/lib/types/character';



interface CardsSectionProps {
   character: Character;
   isEditing: boolean;
   onExport: (item: CardData) => void;
   onEditCard: (card: CardData) => void;
   onAddCard: () => void;
   cardIds: string[];
}

/**
 * The character sheet's cards region: a SortableContext of the character's cards
 * (each rendered via CardRenderer) plus the add-card button. Presentational apart
 * from registering its own `card-drop-zone` droppable (which must happen inside
 * the DndContext subtree); the memoized card id array and all handlers arrive
 * from the page.
 */
export function CardsSection({
   character,
   isEditing,
   onExport,
   onEditCard,
   onAddCard,
   cardIds,
}: CardsSectionProps) {
   const { setNodeRef: cardsDropRef, isOver: isOverCards } = useDroppable({
      id: 'card-drop-zone',
      data: { type: 'card-drop-zone' }
   });

   return (
      <div
         data-tour="cards-section"
         ref={cardsDropRef}
         className={cn(
            "flex flex-wrap gap-12 justify-center w-full p-4 rounded-lg border-2 border-transparent transition-colors",
            { "border-primary bg-muted/50 shadow-inner": isOverCards }
         )}
      >
         {/* Cards Group */}
         <SortableContext items={cardIds} strategy={rectSortingStrategy}>
            {character.cards.map(card => (
               <Sortable
                  key={card.id}
                  id={card.id}
                  data={{ type: DRAG_TYPES.SHEET_CARD, item: card }}
               >
                  {({ dragAttributes, dragListeners, isBeingDragged }) => (
                     <DragLayoutWrapper isBeingDragged={isBeingDragged}>
                        <CardRenderer
                           card={card}
                           isEditing={isEditing}
                           dragAttributes={dragAttributes}
                           dragListeners={dragListeners}
                           onEditCard={() => onEditCard(card)}
                           onExport={() => onExport(card)}
                        />
                     </DragLayoutWrapper>
                  )}
               </Sortable>
            ))}
         </SortableContext>
         {isEditing && <AddCardButton onClick={onAddCard} />}
      </div>
   );
}
