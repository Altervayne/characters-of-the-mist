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
import { SheetAddMenu } from '@/components/organisms/cards/SheetAddMenu';
import { SheetJournalCard } from '@/components/organisms/cards/SheetJournalCard';

// -- Sheet layout manifest --
import { resolveSheetLayout } from '@/lib/character/sheetLayout';

// -- Type Imports --
import type { Character, Card as CardData } from '@/lib/types/character';
import type { Journal } from '@/lib/types/board';



interface CardsSectionProps {
   character: Character;
   isEditing: boolean;
   onExport: (item: CardData | Journal) => void;
   onEditCard: (card: CardData) => void;
   onAddCard: () => void;
   onAddPortrait: () => void;
   onAddChallenge: () => void;
   onAddJournal: () => void;
   /** Highlight the section as the landing spot for a compatible card-type drawer drag. */
   isDropTarget?: boolean;
}

/**
 * The character sheet's cards region: a single SortableContext over the character's ordered
 * `sheetLayout` manifest, walked to resolve each entry to a card (CardRenderer) or a journal
 * (SheetJournalCard) - one reorderable space where cards and journals interleave, plus the add
 * button. Reorder is a live shuffle (`rectSortingStrategy`): siblings animate aside to open a real
 * gap where the dragged element will land. The manifest is walked through the self-healing resolver
 * so a desync can never lose or strand an element. Presentational apart from registering its own
 * `card-drop-zone` droppable (which must happen inside the DndContext subtree); the handlers arrive
 * from the page.
 */
export function CardsSection({
   character,
   isEditing,
   onExport,
   onEditCard,
   onAddCard,
   onAddPortrait,
   onAddChallenge,
   onAddJournal,
   isDropTarget = false,
}: CardsSectionProps) {
   // Portrait is a sheet singleton: the add button only appears when none exists.
   const hasPortrait = character.cards.some(c => c.cardType === 'IMAGE_CARD');
   // Walk the manifest through the self-healing resolver: unknown ids drop, missing content appends.
   const layout = resolveSheetLayout(character);
   const layoutIds = layout.map((entry) => entry.id);
   const cardsById = new Map(character.cards.map((card) => [card.id, card]));
   const journalsById = new Map(character.journals.map((journal) => [journal.id, journal]));
   // Still a droppable (the drop is accepted here / routed by type), but the
   // highlight is now driven by `isDropTarget`, only the section matching the
   // dragged item's type lights up, regardless of which sub-zone the cursor is over.
   const { setNodeRef: cardsDropRef } = useDroppable({
      id: 'card-drop-zone',
      data: { type: 'card-drop-zone' }
   });

   return (
      <div
         data-tutorial="cards-section"
         ref={cardsDropRef}
         className={cn(
            "flex flex-wrap gap-12 justify-center w-full p-4 rounded-lg border-2 border-transparent transition-colors",
            { "border-primary bg-muted/50 shadow-inner": isDropTarget }
         )}
      >
         {/* One sortable space: cards and journals interleave in manifest order. */}
         <SortableContext items={layoutIds} strategy={rectSortingStrategy}>
            {layout.map((entry) => {
               if (entry.kind === 'card') {
                  const card = cardsById.get(entry.id);
                  if (!card) return null;
                  return (
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
                  );
               }
               const journal = journalsById.get(entry.id);
               if (!journal) return null;
               return (
                  <Sortable
                     key={journal.id}
                     id={journal.id}
                     data={{ type: DRAG_TYPES.SHEET_JOURNAL, item: journal }}
                  >
                     {({ dragAttributes, dragListeners, isBeingDragged }) => (
                        <DragLayoutWrapper isBeingDragged={isBeingDragged}>
                           <SheetJournalCard
                              journal={journal}
                              isEditing={isEditing}
                              onExport={() => onExport(journal)}
                              dragAttributes={dragAttributes}
                              dragListeners={dragListeners}
                           />
                        </DragLayoutWrapper>
                     )}
                  </Sortable>
               );
            })}
         </SortableContext>
         {isEditing && (
            <SheetAddMenu
               game={character.game}
               hasPortrait={hasPortrait}
               onAddCard={onAddCard}
               onAddPortrait={onAddPortrait}
               onAddChallenge={onAddChallenge}
               onAddJournal={onAddJournal}
            />
         )}
      </div>
   );
}
