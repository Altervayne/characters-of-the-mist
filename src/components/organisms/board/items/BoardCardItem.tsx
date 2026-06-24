// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { RefreshCw } from 'lucide-react';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { EmbeddedItem, EmbeddedFallback } from './EmbeddedItem';
import { InteractiveEmbed } from './InteractiveEmbed';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { BoardItem, BoardItemContent, CardBoardContent } from '@/lib/types/board';
import type { Card as CardData } from '@/lib/types/character';

/*
 * An embedded drawer CARD on the board. Copy/reference machinery lives in {@link EmbeddedItem}:
 * a reference renders the read-only live snapshot; a COPY renders the real card live and editable
 * via {@link InteractiveEmbed} (its own per-embed character store, seeded with the single card),
 * with edits committed back to `content.data`. Board embeds are FLIP only with a stable footprint.
 */
interface BoardCardItemProps {
   item: BoardItem;
   content: CardBoardContent;
   isSelected: boolean;
   /** The selection toolbar's per-kind slot (the interactive copy's Edit/Flip portal here). */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function BoardCardItem({ item, content, isSelected, toolbarSlot, onContentChange, onCacheLastKnown, onDelete }: BoardCardItemProps) {
   return (
      <EmbeddedItem
         item={item}
         content={content}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         onContentChange={onContentChange}
         onCacheLastKnown={onCacheLastKnown}
         onDelete={onDelete}
         renderSnapshot={(data) => <CardSnapshot data={data} />}
         renderInteractive={({ data, isSelected, toolbarSlot, onCommit }) => (
            <InteractiveEmbed
               slot="cards"
               data={data}
               isSelected={isSelected}
               toolbarSlot={toolbarSlot}
               onCommit={onCommit}
               render={(live, isEditing) => <InteractiveCard card={live as CardData} isEditing={isEditing} />}
               // An image card has no back, so it gets no Flip control.
               renderToolbarExtras={(live) => (live as CardData).cardType === 'IMAGE_CARD' ? null : <CardFlipButton cardId={(live as CardData).id} />}
            />
         )}
      />
   );
}

/** Resolves and renders a card as its real component, live and interactive (board-embed mode). */
function InteractiveCard({ card, isEditing }: { card: CardData; isEditing: boolean }) {
   const { t } = useTranslation();
   const Component = resolveCardComponent(card.cardType, card.details.game);
   if (!Component) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
   // `resolveCardComponent` returns one of the stable module-level organisms, so the
   // static-components rule is a false positive here (same as CardRenderer / the snapshot below).
   // eslint-disable-next-line react-hooks/static-components
   return <Component card={card} isBoardEmbed isEditing={isEditing} />;
}

/** Flips the embed's card via the host store; the new `isFlipped` syncs into `content.data` and persists. */
function CardFlipButton({ cardId }: { cardId: string }) {
   const { t } = useTranslation();
   const { flipCard } = useCharacterActions();
   return (
      <button
         type="button"
         title={t('BoardView.flipEmbed')}
         aria-label={t('BoardView.flipEmbed')}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={() => flipCard(cardId)}
         className="flex cursor-pointer items-center justify-center rounded p-1 text-popover-foreground hover:bg-muted"
      >
         <RefreshCw className="h-4 w-4" />
      </button>
   );
}

/** Resolves and renders a card (reference live content) as its real component, read-only. */
function CardSnapshot({ data }: { data: unknown }) {
   const { t } = useTranslation();
   const card = data as CardData;
   const Component = resolveCardComponent(card.cardType, card.details.game);
   if (!Component) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
   // eslint-disable-next-line react-hooks/static-components
   return <Component card={card} isDrawerPreview />;
}
