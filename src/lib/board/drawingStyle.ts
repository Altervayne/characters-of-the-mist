// -- Type Imports --
import type { DrawingBoardContent, Stroke } from '@/lib/types/board';

/*
 * Pure geometry + style helpers for freehand drawing layers. Kept free of React/store so the path
 * builder, the local-coord rebasing, and the bounds math are unit-testable. The smoothed path is
 * derived here at paint time (Catmull-Rom -> cubic bezier); only the raw sample points are stored.
 */

/** A fresh pen stroke's width, in world px (ink scales with the board). Mirrors the mid connection width. */
export const DEFAULT_STROKE_WIDTH = 3;

/**
 * Resolves a stroke's ink to a CSS color. `null` is the adaptive default - the theme foreground token,
 * which stays legible on any board theme - while a set hex is used verbatim (ink is the one sanctioned
 * raw-hex place). Mirrors {@link textStyleToCss}'s color handling.
 */
export function strokeColorToCss(color: string | null): string {
   return color ?? 'var(--foreground)';
}

/** The world-space bounds of a flat `[x0,y0,x1,y1,...]` point list, or null when it holds no point. */
export function pointsBounds(points: number[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
   if (points.length < 2) return null;
   let minX = Infinity;
   let minY = Infinity;
   let maxX = -Infinity;
   let maxY = -Infinity;
   for (let i = 0; i < points.length - 1; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
   }
   return { minX, minY, maxX, maxY };
}

/** Rebases a flat point list by subtracting an origin (world -> layer-local, or the inverse with a negated origin). */
export function rebasePoints(points: number[], originX: number, originY: number): number[] {
   const out = new Array<number>(points.length);
   for (let i = 0; i < points.length - 1; i += 2) {
      out[i] = points[i] - originX;
      out[i + 1] = points[i + 1] - originY;
   }
   return out;
}

/**
 * Builds a smoothed SVG path from a flat `[x0,y0,...]` point list via a Catmull-Rom spline converted to
 * cubic beziers, so a freehand stroke reads as a curve rather than a polygon. An empty list yields no
 * path; a single point yields a zero-length segment (a round-capped dot); two points yield a straight line.
 */
export function buildStrokePath(points: number[]): string {
   const count = Math.floor(points.length / 2);
   if (count === 0) return '';
   const at = (index: number) => {
      const clamped = Math.min(Math.max(index, 0), count - 1);
      return { x: points[clamped * 2], y: points[clamped * 2 + 1] };
   };
   const first = at(0);
   if (count === 1) return `M ${first.x} ${first.y} L ${first.x} ${first.y}`;

   let d = `M ${first.x} ${first.y}`;
   for (let i = 0; i < count - 1; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
   }
   return d;
}

/** A fresh pen stroke over a flat point list, with the single brush + adaptive ink. */
export function makePenStroke(id: string, points: number[]): Stroke {
   return { id, brush: 'pen', color: null, width: DEFAULT_STROKE_WIDTH, points };
}

/** The minimal drawing-layer shape the box math reads: its live origin plus its strokes. */
type DrawingBox = { x: number; y: number; content: DrawingBoardContent };

/** A resolved box (origin + size) plus the strokes re-based to that origin - the shape a layer grows/shrinks into. */
export interface DrawingBoxResult {
   x: number;
   y: number;
   width: number;
   height: number;
   strokes: Stroke[];
}

/** Folds a point list's bounds into a running union (null-safe both ways). */
function foldBounds(
   into: { minX: number; minY: number; maxX: number; maxY: number } | null,
   points: number[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
   const next = pointsBounds(points);
   if (!next) return into;
   if (!into) return next;
   return {
      minX: Math.min(into.minX, next.minX),
      minY: Math.min(into.minY, next.minY),
      maxX: Math.max(into.maxX, next.maxX),
      maxY: Math.max(into.maxY, next.maxY),
   };
}

/**
 * Grows a drawing layer to hold one more stroke. `strokeWorldPoints` is the new stroke in WORLD coords
 * (its ink position, stable under any re-basing); `makeStroke` stamps it into a layer-local stroke. The
 * new box is the union of every stroke over the new origin: when the origin holds (the stroke sits within
 * or below/right of it) the existing strokes are left untouched and only w/h grow; when the stroke reaches
 * up/left the origin shifts and every stroke re-bases to it, so the locals stay put on screen. Points stay
 * layer-local in the result; world is only the transient frame.
 */
export function appendStrokeToDrawing(
   item: DrawingBox,
   strokeWorldPoints: number[],
   makeStroke: (localPoints: number[]) => Stroke,
): DrawingBoxResult {
   const existing = item.content.strokes;
   // The new stroke into the current local frame (relative to the layer's current origin).
   const newLocal = rebasePoints(strokeWorldPoints, item.x, item.y);
   let bounds = foldBounds(null, newLocal);
   for (const stroke of existing) bounds = foldBounds(bounds, stroke.points);
   // No point anywhere (a degenerate stroke): keep the origin, zero the size, hold just the new stroke.
   if (!bounds) return { x: item.x, y: item.y, width: 0, height: 0, strokes: [makeStroke(newLocal)] };

   const shiftX = bounds.minX;
   const shiftY = bounds.minY;
   const width = bounds.maxX - bounds.minX;
   const height = bounds.maxY - bounds.minY;
   // Origin unchanged: append without re-basing the rest (the common, fast case).
   if (shiftX === 0 && shiftY === 0) {
      return { x: item.x, y: item.y, width, height, strokes: [...existing, makeStroke(newLocal)] };
   }
   // Origin moved up/left: re-base every stroke to the new origin so the ink holds still while the box grows.
   const strokes = existing.map((stroke) => ({ ...stroke, points: rebasePoints(stroke.points, shiftX, shiftY) }));
   strokes.push(makeStroke(rebasePoints(newLocal, shiftX, shiftY)));
   return { x: item.x + shiftX, y: item.y + shiftY, width, height, strokes };
}

/**
 * Shrinks a drawing layer back after a stroke is removed (an append's undo): drops the stroke by id,
 * re-fits the box to the union of the remaining strokes, and re-bases them to the tightened origin. The
 * inverse of {@link appendStrokeToDrawing} - the ink that stays holds its screen position. Callers append
 * onto a layer that always keeps at least its first stroke, so the remainder is non-empty in practice.
 */
export function recomputeDrawingBoxWithout(item: DrawingBox, strokeId: string): DrawingBoxResult {
   const remaining = item.content.strokes.filter((stroke) => stroke.id !== strokeId);
   let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
   for (const stroke of remaining) bounds = foldBounds(bounds, stroke.points);
   if (!bounds) return { x: item.x, y: item.y, width: 0, height: 0, strokes: remaining };

   const shiftX = bounds.minX;
   const shiftY = bounds.minY;
   const strokes =
      shiftX === 0 && shiftY === 0
         ? remaining
         : remaining.map((stroke) => ({ ...stroke, points: rebasePoints(stroke.points, shiftX, shiftY) }));
   return { x: item.x + shiftX, y: item.y + shiftY, width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, strokes };
}
