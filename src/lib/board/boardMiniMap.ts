// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * Pure geometry for the drawer's schematic board mini-map: the content bounding box (used as the SVG
 * viewBox so scaling/centering is automatic) and an item's center (where connection lines anchor).
 * Framework-free so the math is unit-testable; the component just paints rects/lines from it.
 */

/** The content bounding box: an origin plus a size, in board world units. */
export interface BoardBounds {
   minX: number;
   minY: number;
   width: number;
   height: number;
}

/** Floor for a bbox side, so a 1-item or zero-extent board still has a renderable viewBox. */
const MIN_BOUNDS_SIZE = 1;

/**
 * The bounding box over all NON-connection items (connections carry no placement - their x/y/w/h are
 * zero - so they never widen the box). Returns `null` when there is nothing placed to frame.
 */
export function boardContentBounds(items: BoardItem[]): BoardBounds | null {
   let minX = Infinity;
   let minY = Infinity;
   let maxX = -Infinity;
   let maxY = -Infinity;
   let placed = 0;

   for (const item of items) {
      if (item.kind === 'connection') continue;
      placed++;
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
   }
   if (placed === 0) return null;

   return {
      minX,
      minY,
      width: Math.max(MIN_BOUNDS_SIZE, maxX - minX),
      height: Math.max(MIN_BOUNDS_SIZE, maxY - minY),
   };
}

/** An item's center point; a connection's line runs between its endpoints' centers. */
export function itemCenter(item: { x: number; y: number; width: number; height: number }): { cx: number; cy: number } {
   return { cx: item.x + item.width / 2, cy: item.y + item.height / 2 };
}
