// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { EmbeddedItem, EmbeddedFallback } from './EmbeddedItem';

// -- Type Imports --
import type { BoardItem, BoardItemContent, CardBoardContent } from '@/lib/types/board';
import type { Card as CardData } from '@/lib/types/character';

/*
 * An embedded drawer CARD on the board. A copy renders its own snapshot; a reference
 * mirrors the live drawer item read-only. All of that copy/reference machinery lives in
 * {@link EmbeddedItem}; this just supplies the card snapshot render.
 */
interface BoardCardItemProps {
   item: BoardItem;
   content: CardBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function BoardCardItem({ item, content, isSelected, onContentChange, onCacheLastKnown, onDelete }: BoardCardItemProps) {
   return (
      <EmbeddedItem
         item={item}
         content={content}
         isSelected={isSelected}
         onContentChange={onContentChange}
         onCacheLastKnown={onCacheLastKnown}
         onDelete={onDelete}
         renderSnapshot={(data) => <CardSnapshot data={data} />}
      />
   );
}

/** Resolves and renders a card (copy data or live reference content) as its real component. */
function CardSnapshot({ data }: { data: unknown }) {
   const { t } = useTranslation();
   const card = data as CardData;
   const Component = resolveCardComponent(card.cardType, card.details.game);
   if (!Component) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
   // `resolveCardComponent` returns one of six stable module-level organisms, never a
   // freshly constructed component, so the static-components rule is a false positive
   // here (same as CardRenderer).
   // eslint-disable-next-line react-hooks/static-components
   return <Component card={card} isDrawerPreview />;
}
