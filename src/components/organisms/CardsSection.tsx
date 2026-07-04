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
import { AddPortraitButton } from '@/components/molecules/AddPortraitButton';
import { AddChallengeCardButton } from '@/components/molecules/AddChallengeCardButton';

// -- Type Imports --
import type { Character, Card as CardData } from '@/lib/types/character';



interface CardsSectionProps {
   character: Character;
   isEditing: boolean;
   onExport: (item: CardData) => void;
   onEditCard: (card: CardData) => void;
   onAddCard: () => void;
   onAddPortrait: () => void;
   onAddChallenge: () => void;
   cardIds: string[];
   /** Highlight the section as the landing spot for a compatible card-type drawer drag. */
   isDropTarget?: boolean;
}

/**
 * The character sheet's cards region: a SortableContext of the character's cards
 * (each rendered via CardRenderer) plus the add-card button. Reorder is a live
 * shuffle (`rectSortingStrategy`): siblings animate aside to open a real gap where
 * the dragged card will land. Presentational apart from registering its own
 * `card-drop-zone` droppable (which must happen inside the DndContext subtree); the
 * memoized card id array and all handlers arrive from the page.
 */
export function CardsSection({
   character,
   isEditing,
   onExport,
   onEditCard,
   onAddCard,
   onAddPortrait,
   onAddChallenge,
   cardIds,
   isDropTarget = false,
}: CardsSectionProps) {
   // Portrait is a sheet singleton: the add button only appears when none exists.
   const hasPortrait = character.cards.some(c => c.cardType === 'IMAGE_CARD');
   // Still a droppable (the drop is accepted here / routed by type), but the
   // highlight is now driven by `isDropTarget`, only the section matching the
   // dragged item's type lights up, regardless of which sub-zone the cursor is over.
   const { setNodeRef: cardsDropRef } = useDroppable({
      id: 'card-drop-zone',
      data: { type: 'card-drop-zone' }
   });

   return (
      <div
         data-tour="cards-section"
         ref={cardsDropRef}
         className={cn(
            "flex flex-wrap gap-12 justify-center w-full p-4 rounded-lg border-2 border-transparent transition-colors",
            { "border-primary bg-muted/50 shadow-inner": isDropTarget }
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
         {isEditing && !hasPortrait && <AddPortraitButton onClick={onAddPortrait} />}
         {isEditing && <AddChallengeCardButton onClick={onAddChallenge} />}
      </div>
   );
}
