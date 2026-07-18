// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Maximize2, Minimize2, PencilRuler, RefreshCw } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';
import { ViewModeIcon } from '@/components/molecules/ToolbarHandle';
import { ChallengeCardEditor } from '@/components/organisms/dialogs/ChallengeCardEditor';
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
 * box width-fits the card's natural width (grows to both faces, shrinks back to one on flip). A
 * challenge card also has an EXPANDED display mode (`card.expanded`, persisted): the board item renders
 * its landscape sheet in place of the flip card, and the box uses the fixed expanded footprint.
 */
interface BoardCardItemProps {
   item: BoardItem;
   content: CardBoardContent;
   isSelected: boolean;
   /** The selection toolbar's per-kind slot (the interactive copy's Edit/Flip/Expand portal here). */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   /** Adopts a Save-As drawer id onto the copy's source link via a direct (non-undoable) write. */
   onAdoptSource: (id: string, sourceDrawerItemId: string) => void;
   onDelete: (id: string) => void;
}

export function BoardCardItem({ item, content, isSelected, toolbarSlot, onContentChange, onCacheLastKnown, onAdoptSource, onDelete }: BoardCardItemProps) {
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
         onAdoptSource={onAdoptSource}
         onDelete={onDelete}
         renderSnapshot={(data) => <CardSnapshot data={data} />}
         renderInteractive={({ data, isSelected, toolbarSlot, onCommit }) => (
            <InteractiveEmbed
               slot="cards"
               data={data}
               isSelected={isSelected}
               toolbarSlot={toolbarSlot}
               onCommit={onCommit}
               render={(live, isEditing) => (
                  <InteractiveCard card={live as CardData} isEditing={isEditing} onMentionClick={handleMentionClick} />
               )}
               // Image cards have no back, so they get neither control. Others get a view-mode toggle, plus
               // the flip button only in flip mode (in side-by-side both faces show, so flipping is moot).
               // A challenge card also gets a Card <-> Expanded toggle; in Expanded mode the flip / view-mode
               // controls are moot (the landscape sheet shows everything), so only the collapse toggle stays.
               renderToolbarExtras={(live) => {
                  const card = live as CardData;
                  if (card.cardType === 'IMAGE_CARD') return null;
                  const isChallenge = card.cardType === 'CHALLENGE_CARD';
                  const isExpanded = isChallenge && card.expanded === true;
                  const isFlip = (card.viewMode ?? 'FLIP') === 'FLIP';
                  return (
                     <>
                        {isChallenge && <CardEditDialogButton card={card} />}
                        {isChallenge && <CardExpandButton cardId={card.id} isExpanded={isExpanded} />}
                        {!isExpanded && <CardViewModeButton cardId={card.id} viewMode={card.viewMode} />}
                        {!isExpanded && isFlip && <CardFlipButton cardId={card.id} />}
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
   // Only the Challenge Card reads `onMentionClick` / `isExpanded` (the latter from `card.expanded`);
   // every other card ignores them.
   // eslint-disable-next-line react-hooks/static-components
   return <Component card={card} isBoardEmbed isEditing={isEditing} isExpanded={card.expanded === true} onMentionClick={onMentionClick} />;
}

/**
 * Opens the full {@link ChallengeCardEditor} dialog for a board challenge card - the same editor the sheet
 * uses, a third edit affordance beside the inline-edit pencil and the Expand toggle. It renders inside the
 * embed's host-store provider (via the toolbar-extras slot), so its `updateCardTitle` / `updateCardDetails`
 * commits land on the per-embed store and sync back to the copy's `content.data`, exactly like inline edits.
 */
function CardEditDialogButton({ card }: { card: CardData }) {
   const { t } = useTranslation();
   const [isOpen, setIsOpen] = useState(false);
   return (
      <>
         <button
            type="button"
            title={t('BoardView.editChallengeCard')}
            aria-label={t('BoardView.editChallengeCard')}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsOpen(true)}
            className="flex cursor-pointer items-center justify-center rounded p-1 text-popover-foreground hover:bg-muted"
         >
            <PencilRuler className="h-4 w-4" />
         </button>
         <ChallengeCardEditor isOpen={isOpen} onOpenChange={setIsOpen} card={isOpen ? card : null} modal />
      </>
   );
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

/**
 * Toggles the challenge card's board display mode between Card and Expanded via the host store; the new
 * `expanded` flag syncs into `content.data` and persists (survives reload / export). Maximize2 expands,
 * Minimize2 collapses - mirroring how the flip / view-mode controls toggle a card's presentation.
 */
function CardExpandButton({ cardId, isExpanded }: { cardId: string; isExpanded: boolean }) {
   const { t } = useTranslation();
   const { setCardExpanded } = useCharacterActions();
   const label = isExpanded ? t('BoardView.collapseEmbed') : t('BoardView.expandEmbed');
   return (
      <button
         type="button"
         title={label}
         aria-label={label}
         onPointerDown={(event) => event.stopPropagation()}
         onClick={() => setCardExpanded(cardId, !isExpanded)}
         className={cn(
            'flex cursor-pointer items-center justify-center rounded p-1',
            isExpanded ? 'bg-muted text-primary' : 'text-popover-foreground hover:bg-muted',
         )}
      >
         {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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
