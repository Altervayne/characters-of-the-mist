/*
 * Z-index bands for the board's world layer. Items render in ONE stable pass (never split by
 * selection), so selecting one only changes its z-index - its React instance is preserved, so the
 * editing surface is never torn down (edits commit) and images don't reload. Paint order is decided
 * here by explicit z-index, not DOM order.
 *
 * For N non-connection items, ranked 0..N-1 by stored board z:
 *   0             zone tinted rects (the back layer)        - behind everything
 *   1 .. N        unselected item boxes (1 + rank)
 *   N + 1         the connection layer (lines + selected-line toolbar)
 *   N+2 .. 2N+1   selected item boxes (N + 2 + rank)
 *   2N + 2        the group toolbar                          - above everything
 *
 * The bands are disjoint by construction for any N, so a selected item ALWAYS sits above the
 * connection layer and above every unselected item, whatever the stored z - it's bulletproof, not
 * tuned. Within a band the stored z order is preserved (via rank), so bring-to-front / send-to-back
 * still order among unselected AND among selected.
 */

/** The back layer (zone tinted rects): behind every item. */
export const BACK_LAYER_Z_INDEX = 0;

/** An item box's z-index, from its rank (index in stored-z order) and whether it is selected. */
export function itemZIndex(rank: number, selected: boolean, n: number): number {
   return selected ? n + 2 + rank : 1 + rank;
}

/** The connection layer's z-index: strictly above every unselected item, below every selected one. */
export function connectionsZIndex(n: number): number {
   return n + 1;
}

/** The multi-selection group toolbar's z-index: above the whole selected band. */
export function groupToolbarZIndex(n: number): number {
   return 2 * n + 2;
}
