// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';
import type { Card } from '@/lib/types/character';

/*
 * Whether a board item is a card copy currently in its EXPANDED display mode. The expanded flag is a
 * persisted, per-card display choice (like `viewMode`) stored on the card copy's `content.data`, so it
 * survives reload / export - the box reads it here to pick the fixed landscape footprint over the
 * portrait fit-width. Only a card copy can be expanded; a reference / non-card is always false.
 */
export function isExpandedCardItem(item: BoardItem): boolean {
   const { content } = item;
   if (content.kind !== 'card' || content.mode !== 'copy') return false;
   return (content.data as Card | undefined)?.expanded === true;
}
