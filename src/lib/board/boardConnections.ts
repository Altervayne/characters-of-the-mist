// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * Pure geometry + lookup for board connections. A connection is a straight line drawn
 * edge-to-edge between two items, clipped to each item's bounding box along the
 * centre-to-centre ray (the spec's nearest-edge lean), so it tracks both items as they
 * move or resize. Kept framework-free so the math is unit-testable.
 */

/** A point in world coordinates. */
export interface Point {
   x: number;
   y: number;
}

/** The minimal placement a connection endpoint reads from an item. */
export interface RectLike {
   x: number;
   y: number;
   width: number;
   height: number;
}

/** Default styling for a freshly drawn connection (visible on both light and dark). */
export const DEFAULT_CONNECTION_STYLE = { width: 3, color: '#3b82f6' } as const;

/**
 * The point on the boundary of a box (centre `cx,cy`, half-extents `hw,hh`) along the
 * ray `(dx,dy)` from its centre. Returns the centre for a zero direction (degenerate).
 */
function boxEdgePoint(cx: number, cy: number, hw: number, hh: number, dx: number, dy: number): Point {
   if (dx === 0 && dy === 0) return { x: cx, y: cy };
   // Scale the ray so it just reaches the nearer of the vertical / horizontal edges.
   const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
   const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
   const t = Math.min(tx, ty);
   return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * The two endpoints of a connection between `fromItem` and `toItem`: each is where the
 * centre-to-centre line crosses that item's box edge, so the line runs edge-to-edge.
 * Pass a zero-size rect for a free end (the connect-drag preview to the cursor).
 */
export function connectionEndpoints(fromItem: RectLike, toItem: RectLike): { from: Point; to: Point } {
   const aCx = fromItem.x + fromItem.width / 2;
   const aCy = fromItem.y + fromItem.height / 2;
   const bCx = toItem.x + toItem.width / 2;
   const bCy = toItem.y + toItem.height / 2;
   const dx = bCx - aCx;
   const dy = bCy - aCy;
   return {
      from: boxEdgePoint(aCx, aCy, fromItem.width / 2, fromItem.height / 2, dx, dy),
      to: boxEdgePoint(bCx, bCy, toItem.width / 2, toItem.height / 2, -dx, -dy),
   };
}

/**
 * The ids of every connection item that references `itemId` (as `from` or `to`). Used to
 * cascade-delete an item's lines so no orphan line is ever left behind.
 */
export function connectionsReferencing(items: Record<string, BoardItem>, itemId: string): string[] {
   return Object.values(items)
      .filter((item) => item.content.kind === 'connection' && (item.content.from === itemId || item.content.to === itemId))
      .map((item) => item.id);
}
