/*
 * Pure resize math for the board item box. The bottom-right grip grows width/height with
 * x/y pinned. Min-height kinds (e.g. the dice tray) pass their live content height as the
 * height floor, so a drag can make the box TALLER but never shorter than its content (which
 * is the scroll/clip the user rejected).
 */

/** Smallest a box may be resized to, in world units. */
export const MIN_ITEM_SIZE = 40;

export interface SizeRect {
   x: number;
   y: number;
   width: number;
   height: number;
}

/**
 * Applies a bottom-right resize delta to `orig` (width/height grow, x/y fixed). Width floors
 * at {@link MIN_ITEM_SIZE}; height floors at `minHeight` (default {@link MIN_ITEM_SIZE}) - pass
 * the content height for a min-height item so it can't be dragged shorter than its content.
 */
export function computeResize(orig: SizeRect, delta: { x: number; y: number }, minHeight: number = MIN_ITEM_SIZE): SizeRect {
   return {
      x: orig.x,
      y: orig.y,
      width: Math.max(MIN_ITEM_SIZE, orig.width + delta.x),
      height: Math.max(minHeight, orig.height + delta.y),
   };
}

/** The height a min-height item actually renders at: never below its measured content. */
export function effectiveHeight(storedHeight: number, contentHeight: number): number {
   return Math.max(storedHeight, contentHeight);
}
