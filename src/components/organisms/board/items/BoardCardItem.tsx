// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { resolveCardComponent } from '@/components/organisms/cards/resolveCardComponent';

// -- Type Imports --
import type { CardBoardContent } from '@/lib/types/board';
import type { Card as CardData } from '@/lib/types/character';

/*
 * Renders an embedded drawer CARD on the board, as the real card component in its
 * compact snapshot form (`isDrawerPreview`, like the drawer's own preview). Read-only
 * here: the card is not editable on the board. Reads from the board item's copied data,
 * so it never touches the character context. References (board-10) reuse this and just
 * resolve `data` from the source drawer item instead.
 */
export function BoardCardItem({ content }: { content: CardBoardContent }) {
   const { t } = useTranslation();

   // Copies only in this prompt; a reference has no inline data yet.
   if (content.mode !== 'copy') return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;

   const card = content.data as CardData;
   const Component = resolveCardComponent(card.cardType, card.details.game);
   if (!Component) return <EmbeddedFallback label={t('BoardView.embeddedUnavailable')} />;

   // `pointer-events-none` keeps the snapshot inert so a click/drag falls through to the
   // box body (move/select); the box clips the centered card to its frame.
   return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-card pointer-events-none">
         {/* `resolveCardComponent` returns one of six stable module-level organisms, never
             a freshly constructed component, so the static-components rule is a false
             positive here (same as CardRenderer). */}
         {/* eslint-disable-next-line react-hooks/static-components */}
         <Component card={card} isDrawerPreview />
      </div>
   );
}

/** A neutral placeholder when an embedded item can't be rendered (missing renderer / not a copy). */
export function EmbeddedFallback({ label }: { label: string }) {
   return (
      <div className="flex h-full w-full items-center justify-center bg-card p-2 text-center text-xs text-muted-foreground">
         {label}
      </div>
   );
}
