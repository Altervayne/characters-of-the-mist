// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Maximize2, RefreshCw } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { ViewModeIcon } from '@/components/molecules/ToolbarHandle';
import { EmbeddedItem, EmbeddedFallback } from './EmbeddedItem';
import { InteractiveEmbed } from './InteractiveEmbed';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useBoardMentionMint } from '@/hooks/board/useBoardMentionMint';

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
   /** The selection toolbar's per-kind slot (the interactive copy's Edit/Flip/Expand portal here). */
   toolbarSlot: HTMLElement | null;
   /** Whether this item's expanded challenge overlay is open (board-view `expandedItemId`, ephemeral). */
   isExpanded: boolean;
   /** Requests this item's expanded overlay open/close. */
   onExpandedChange: (expanded: boolean) => void;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onDelete: (id: string) => void;
}

export function BoardCardItem({ item, content, isSelected, toolbarSlot, isExpanded, onExpandedChange, onContentChange, onCacheLastKnown, onDelete }: BoardCardItemProps) {
   // Tapping a mention on the interactive COPY mints a fresh board-native tracker beside the challenge.
   const handleMentionClick = useBoardMentionMint(item);

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
               isExpanded={isExpanded}
               onExpandedChange={onExpandedChange}
               render={(live, isEditing, expanded) => (
                  <InteractiveCard card={live as CardData} isEditing={isEditing} isExpanded={expanded} onMentionClick={handleMentionClick} onCollapse={() => onExpandedChange(false)} />
               )}
               // Image cards have no back, so they get neither control. Others get a view-mode toggle, plus
               // the flip button only in flip mode (in side-by-side both faces show, so flipping is moot).
               // A challenge card also gets an Expand affordance for its landscape overlay sheet.
               renderToolbarExtras={(live, expand) => {
                  const card = live as CardData;
                  if (card.cardType === 'IMAGE_CARD') return null;
                  const isFlip = (card.viewMode ?? 'FLIP') === 'FLIP';
                  return (
                     <>
                        {card.cardType === 'CHALLENGE_CARD' && <CardExpandButton isExpanded={expand.isExpanded} onExpandedChange={expand.onExpandedChange} />}
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
function InteractiveCard({ card, isEditing, isExpanded, onMentionClick, onCollapse }: { card: CardData; isEditing: boolean; isExpanded: boolean; onMentionClick: (segment: MentionSegment) => void; onCollapse: () => void }) {
   const { t } = useTranslation();
   const Component = resolveCardComponent(card.cardType, card.details.game);
   if (!Component) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;
   // `resolveCardComponent` returns one of the stable module-level organisms, so the
   // static-components rule is a false positive here (same as CardRenderer / the snapshot below).
   // Side-by-side lays the faces out horizontally (the default row); the box width-fits to suit.
   // Only the Challenge Card reads `onMentionClick` / `isExpanded` / `onCollapse`; every other card ignores them.
   // eslint-disable-next-line react-hooks/static-components
   return <Component card={card} isBoardEmbed isEditing={isEditing} isExpanded={isExpanded} onMentionClick={onMentionClick} onCollapse={onCollapse} />;
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

/** Toggles the challenge card's expanded overlay sheet (board-view `expandedItemId`, ephemeral - not persisted). */
function CardExpandButton({ isExpanded, onExpandedChange }: { isExpanded: boolean; onExpandedChange: (expanded: boolean) => void }) {
   const { t } = useTranslation();
   return (
      <button
         type="button"
         title={t('BoardView.expandEmbed')}
         aria-label={t('BoardView.expandEmbed')}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={() => onExpandedChange(!isExpanded)}
         className={cn(
            'flex cursor-pointer items-center justify-center rounded p-1',
            isExpanded ? 'bg-muted text-primary' : 'text-popover-foreground hover:bg-muted',
         )}
      >
         <Maximize2 className="h-4 w-4" />
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
