/*
 * Pure resize math for the board item box. The bottom-right grip grows width/height with
 * x/y pinned. Some kinds floor an axis higher than {@link MIN_ITEM_SIZE}: the dice tray passes
 * its live content height (can grow TALLER but never shorter than its content), and a zone passes
 * the extent of its members (can't shrink so small it stops enclosing them).
 */

/** Smallest a box may be resized to, in world units. */
export const MIN_ITEM_SIZE = 40;

export interface SizeRect {
   x: number;
   y: number;
   width: number;
   height: number;
}

/** Per-axis lower bounds for a resize; an omitted axis floors at {@link MIN_ITEM_SIZE}. */
export interface SizeFloor {
   width?: number;
   height?: number;
}

/**
 * Applies a bottom-right resize delta to `orig` (width/height grow, x/y fixed). Each axis floors
 * at the matching `min` value, defaulting to {@link MIN_ITEM_SIZE} - pass a higher floor for a
 * min-content kind (the dice tray's content height, a zone's member extent).
 */
export function computeResize(orig: SizeRect, delta: { x: number; y: number }, min: SizeFloor = {}): SizeRect {
   return {
      x: orig.x,
      y: orig.y,
      width: Math.max(min.width ?? MIN_ITEM_SIZE, orig.width + delta.x),
      height: Math.max(min.height ?? MIN_ITEM_SIZE, orig.height + delta.y),
   };
}

/** The height a min-height item actually renders at: never below its measured content. */
export function effectiveHeight(storedHeight: number, contentHeight: number): number {
   return Math.max(storedHeight, contentHeight);
}
