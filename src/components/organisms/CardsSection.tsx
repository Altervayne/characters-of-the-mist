// -- Other Library Imports --
import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';
import { staticListSortingStrategy } from '@/lib/utils/dnd';

// -- DnD Component Imports --
import { Sortable, DragLayoutWrapper } from '@/components/dnd';

// -- Component Imports --
import { CardRenderer } from '@/components/organisms/cards/CardRenderer';
import { AddCardButton } from '@/components/molecules/AddThemeCardButton';
import { AddPortraitButton } from '@/components/molecules/AddPortraitButton';
import { DropInsertionLine } from '@/components/molecules/DropInsertionLine';

// -- Type Imports --
import type { Character, Card as CardData } from '@/lib/types/character';
import type { ReorderIndicator } from '@/lib/utils/dragFeedback';



interface CardsSectionProps {
   character: Character;
   isEditing: boolean;
   onExport: (item: CardData) => void;
   onEditCard: (card: CardData) => void;
   onAddCard: () => void;
   onAddPortrait: () => void;
   cardIds: string[];
   /** Highlight the section as the landing spot for a compatible card-type drawer drag. */
   isDropTarget?: boolean;
   /** The active reorder insertion line; rendered when it targets a card. */
   reorderIndicator?: ReorderIndicator | null;
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
   onAddPortrait,
   cardIds,
   isDropTarget = false,
   reorderIndicator = null,
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
         {/* Static layout during a drag (no live shuffle); a single vertical insertion
             line (left/right edge of the hovered card) shows where it lands. */}
         <SortableContext items={cardIds} strategy={staticListSortingStrategy}>
            {character.cards.map(card => {
               const onThisCard = reorderIndicator?.listId === 'sheet-cards' && reorderIndicator.overId === card.id;
               return (
                  <div key={card.id} className="relative">
                     {onThisCard && reorderIndicator?.position === 'before' && <DropInsertionLine orientation="vertical" position="before" />}
                     <Sortable
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
                     {onThisCard && reorderIndicator?.position === 'after' && <DropInsertionLine orientation="vertical" position="after" />}
                  </div>
               );
            })}
         </SortableContext>
         {isEditing && <AddCardButton onClick={onAddCard} />}
         {isEditing && !hasPortrait && <AddPortraitButton onClick={onAddPortrait} />}
      </div>
   );
}
