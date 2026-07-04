// -- React Imports --
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import cuid from 'cuid';
import toast from 'react-hot-toast';

// -- Icon Imports --
import { RefreshCw } from 'lucide-react';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { ViewModeIcon } from '@/components/molecules/ToolbarHandle';
import { EmbeddedItem, EmbeddedFallback } from './EmbeddedItem';
import { InteractiveEmbed } from './InteractiveEmbed';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';

// -- Utils Imports --
import { trackerBoardItemForMention } from '@/lib/board/mintTrackerFromMention';

// -- Type Imports --
import type { BoardItem, BoardItemContent, CardBoardContent } from '@/lib/types/board';
import type { Card as CardData, CardViewMode } from '@/lib/types/character';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * An embedded drawer CARD on the board. Copy/reference machinery lives in {@link EmbeddedItem}:
 * a reference renders the read-only live snapshot; a COPY renders the real card live and editable
 * via {@link InteractiveEmbed} (its own per-embed character store, seeded with the single card),
 * with edits committed back to `content.data`. Each board card carries its own view mode (flip by
 * default, never the global side-by-side); side-by-side lays the two faces out horizontally and the
 * box width-fits the card's natural width (grows to both faces, shrinks back to one on flip).
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
   const { t } = useTranslation();
   // Per-tap cascade so repeated mints from the same challenge don't stack exactly.
   const cascadeRef = useRef(0);

   // Tapping a mention on the interactive COPY mints a fresh board-native tracker beside the challenge
   // (create-only - the board isn't single-owner, so no raise/dedup). It must go through the BOARD store,
   // not character actions, which would hit the embed's throwaway per-embed store.
   const handleMentionClick = (segment: MentionSegment) => {
      const boardStore = getActiveBoardStore();
      const spec = trackerBoardItemForMention(segment, item, cascadeRef.current);
      if (!boardStore || !spec) return;
      cascadeRef.current += 1;
      const z = Object.values(boardStore.getState().items).reduce((max, entry) => Math.max(max, entry.z), -1) + 1;
      void boardStore.getState().actions.addItem({ id: cuid(), z, ...spec });
      if (segment.type !== 'text') toast.success(t('BoardView.mentionAdded', { name: segment.name }));
   };

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
               render={(live, isEditing) => <InteractiveCard card={live as CardData} isEditing={isEditing} onMentionClick={handleMentionClick} />}
               // Image cards have no back, so they get neither control. Others get a view-mode toggle, plus
               // the flip button only in flip mode (in side-by-side both faces show, so flipping is moot).
               renderToolbarExtras={(live) => {
                  const card = live as CardData;
                  if (card.cardType === 'IMAGE_CARD') return null;
                  const isFlip = (card.viewMode ?? 'FLIP') === 'FLIP';
                  return (
                     <>
                        <CardViewModeButton cardId={card.id} viewMode={card.viewMode} />
                        {isFlip && <CardFlipButton cardId={card.id} />}
                     </>
                  );
               }}
            />
         )}
      />
   );
}

/** Resolves and renders a card as its real component, live and interactive (board-embed mode). */
function InteractiveCard({ card, isEditing, onMentionClick }: { card: CardData; isEditing: boolean; onMentionClick: (segment: MentionSegment) => void }) {
   const { t } = useTranslation();
   const Component = resolveCardComponent(card.cardType, card.details.game);
   if (!Component) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
   // `resolveCardComponent` returns one of the stable module-level organisms, so the
   // static-components rule is a false positive here (same as CardRenderer / the snapshot below).
   // Side-by-side lays the faces out horizontally (the default row); the box width-fits to suit.
   // Only the Challenge Card reads `onMentionClick`; every other card ignores it.
   // eslint-disable-next-line react-hooks/static-components
   return <Component card={card} isBoardEmbed isEditing={isEditing} onMentionClick={onMentionClick} />;
}

/** Toggles the embed's card between flip and side-by-side via the host store; persists into `content.data`. */
function CardViewModeButton({ cardId, viewMode }: { cardId: string; viewMode?: CardViewMode | null }) {
   const { t } = useTranslation();
   const { updateCardViewMode } = useCharacterActions();
   // The board is 2-state only (no global); an unset mode reads and toggles as flip.
   const current: CardViewMode = viewMode === 'SIDE_BY_SIDE' ? 'SIDE_BY_SIDE' : 'FLIP';
   const next: CardViewMode = current === 'FLIP' ? 'SIDE_BY_SIDE' : 'FLIP';
   const label = current === 'SIDE_BY_SIDE' ? t('Tooltips.ViewMode.SideBySide') : t('Tooltips.ViewMode.Flipping');
   return (
      <button
         type="button"
         title={label}
         aria-label={label}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={() => updateCardViewMode(cardId, next)}
         className="flex cursor-pointer items-center justify-center rounded p-1 text-popover-foreground hover:bg-muted"
      >
         <ViewModeIcon mode={current} />
      </button>
   );
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
