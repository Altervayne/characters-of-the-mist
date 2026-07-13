// -- Type Imports --
import type { BrushKind, DrawingBoardContent, Stroke } from '@/lib/types/board';

/*
 * Pure geometry + style helpers for freehand drawing layers. Kept free of React/store so the path
 * builder, the local-coord rebasing, and the bounds math are unit-testable. The smoothed path is
 * derived here at paint time (Catmull-Rom -> cubic bezier); only the raw sample points are stored.
 */

/** A fresh stroke's width, in world px (ink scales with the board). The single shared size across brushes. */
export const DEFAULT_STROKE_WIDTH = 3;

/** The highlighter's ink opacity (plain alpha, so it reads translucent on any board theme). */
export const HIGHLIGHTER_OPACITY = 0.4;

/** The eraser's hit tolerance in world px, added to half a stroke's width to form its reach. */
export const ERASER_RADIUS = 8;

/**
 * The broad-nib edge angle for the `brush` brush, in radians. Held a touch off 45deg so axis-aligned
 * strokes (horizontal vs vertical) still differ in weight - a true 45deg nib makes them identical. Tunable.
 */
export const NIB_ANGLE = (40 * Math.PI) / 180;

/** The `brush` brush's thinnest width, as a fraction of its base width (a stroke run along the nib edge). Tunable. */
export const BRUSH_MIN_WIDTH_FACTOR = 0.2;

/** Half-window (in points) for averaging the brush ribbon's heading + width, so raw pointer noise doesn't serrate the edge. Tunable. */
export const BRUSH_SMOOTH_WINDOW = 2;

/** A brush's stroke opacity: highlighter is translucent, pen/brush opaque. */
export function brushOpacity(brush: BrushKind): number {
   return brush === 'highlighter' ? HIGHLIGHTER_OPACITY : 1;
}

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
 * The Catmull-Rom -> cubic-bezier segments over a point list, emitted WITHOUT a leading move (the pen is
 * assumed to already sit at the first point). Ends of the list clamp to their endpoints, so the curve
 * passes through every sample. Fewer than two points yields no segment.
 */
function bezierSegments(pts: { x: number; y: number }[]): string {
   const count = pts.length;
   if (count < 2) return '';
   const at = (index: number) => pts[Math.min(Math.max(index, 0), count - 1)];
   let d = '';
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

/**
 * Builds a smoothed SVG path from a flat `[x0,y0,...]` point list via a Catmull-Rom spline converted to
 * cubic beziers, so a freehand stroke reads as a curve rather than a polygon. An empty list yields no
 * path; a single point yields a zero-length segment (a round-capped dot); two points yield a straight line.
 */
export function buildStrokePath(points: number[]): string {
   const count = Math.floor(points.length / 2);
   if (count === 0) return '';
   const first = { x: points[0], y: points[1] };
   if (count === 1) return `M ${first.x} ${first.y} L ${first.x} ${first.y}`;
   const pts = new Array<{ x: number; y: number }>(count);
   for (let i = 0; i < count; i++) pts[i] = { x: points[i * 2], y: points[i * 2 + 1] };
   return `M ${first.x} ${first.y}${bezierSegments(pts)}`;
}

/**
 * Resamples a point list to roughly even `spacing` arc-length steps, always keeping the endpoints. Dropping
 * the near-coincident samples a fast pointer emits keeps the ribbon's per-point heading from spinning on a
 * sub-pixel span. Degenerate input (all points coincident) collapses to a single point.
 */
function resampleEven(pts: { x: number; y: number }[], spacing: number): { x: number; y: number }[] {
   if (pts.length < 2 || spacing <= 0) return pts.slice();
   const out = [pts[0]];
   let prev = pts[0];
   let acc = 0; // arc length walked since the last emitted point
   for (let i = 1; i < pts.length; i++) {
      let dx = pts[i].x - prev.x;
      let dy = pts[i].y - prev.y;
      let seg = Math.hypot(dx, dy);
      while (acc + seg >= spacing) {
         const t = (spacing - acc) / seg;
         const nx = prev.x + dx * t;
         const ny = prev.y + dy * t;
         out.push({ x: nx, y: ny });
         prev = { x: nx, y: ny };
         dx = pts[i].x - prev.x;
         dy = pts[i].y - prev.y;
         seg = Math.hypot(dx, dy);
         acc = 0;
      }
      acc += seg;
      prev = pts[i];
   }
   const last = pts[pts.length - 1];
   const tail = out[out.length - 1];
   if (Math.hypot(tail.x - last.x, tail.y - last.y) > 1e-6) out.push(last);
   return out;
}

/**
 * Builds a FILLED calligraphy-nib ribbon from a flat `[x0,y0,...]` point list (the stroke's centerline).
 * The nib is a fixed edge at `nibAngle`: the half-width at a point is `(baseWidth/2)` scaled by
 * `lerp(BRUSH_MIN_WIDTH_FACTOR, 1, |sin(heading - nibAngle)|)` - full where the stroke runs perpendicular to
 * the nib, thin where it runs along it (speed-independent, direction only). To keep the edge from serrating
 * on raw pointer noise, the centerline is first resampled to even spacing, then each point's heading is a
 * windowed average of neighbouring segment directions and its nib factor a small moving average - so the
 * perpendiculars and the thickness ease rather than wobble. Both offset edges are drawn as Catmull-Rom
 * curves (the centerline idiom) and joined by rounded bezier end caps into one closed shape painted with
 * `fill` (no stroke). A lone point is a full-width round dot. Sharp cusps may self-overlap; the nonzero fill
 * rule hides it (no boolean union). Render-only: the stored stroke keeps its raw centerline samples + width,
 * so hit-testing and the box bounds are unaffected.
 */
export function buildBrushRibbonPath(points: number[], baseWidth: number, nibAngle: number): string {
   const count = Math.floor(points.length / 2);
   if (count === 0) return '';
   const half = baseWidth / 2;
   const dot = (x: number, y: number) => {
      const r = Math.max(half, 0.01);
      return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
   };
   if (count === 1) return dot(points[0], points[1]);

   const raw = new Array<{ x: number; y: number }>(count);
   for (let i = 0; i < count; i++) raw[i] = { x: points[i * 2], y: points[i * 2 + 1] };
   // Even spacing tied to the brush size: coarse enough to shed pointer jitter, fine enough to hold a curve.
   const pts = resampleEven(raw, Math.max(2, baseWidth * 0.5));
   const m = pts.length;
   if (m === 1) return dot(pts[0].x, pts[0].y);

   // Per-segment unit directions, then a windowed heading per point (a unit-vector mean, so the perpendicular
   // can't flip between near-parallel samples).
   const segX = new Array<number>(m - 1);
   const segY = new Array<number>(m - 1);
   for (let i = 0; i < m - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const len = Math.hypot(dx, dy) || 1;
      segX[i] = dx / len;
      segY[i] = dy / len;
   }
   const win = BRUSH_SMOOTH_WINDOW;
   const heading = new Array<number>(m);
   for (let i = 0; i < m; i++) {
      let sx = 0;
      let sy = 0;
      for (let j = i - win; j <= i + win; j++) {
         const s = Math.min(Math.max(j, 0), m - 2);
         sx += segX[s];
         sy += segY[s];
      }
      heading[i] = Math.atan2(sy, sx);
   }
   // Raw nib factor per point, then a small moving average so thickness eases rather than steps.
   const range = 1 - BRUSH_MIN_WIDTH_FACTOR;
   const factor = new Array<number>(m);
   for (let i = 0; i < m; i++) factor[i] = BRUSH_MIN_WIDTH_FACTOR + range * Math.abs(Math.sin(heading[i] - nibAngle));
   const smooth = new Array<number>(m);
   for (let i = 0; i < m; i++) {
      let sum = 0;
      let n = 0;
      for (let j = i - win; j <= i + win; j++) {
         sum += factor[Math.min(Math.max(j, 0), m - 1)];
         n++;
      }
      smooth[i] = sum / n;
   }

   const left = new Array<{ x: number; y: number }>(m);
   const right = new Array<{ x: number; y: number }>(m);
   for (let i = 0; i < m; i++) {
      const hw = half * smooth[i];
      // The unit normal to the heading: (-sin, cos).
      const nx = -Math.sin(heading[i]) * hw;
      const ny = Math.cos(heading[i]) * hw;
      left[i] = { x: pts[i].x + nx, y: pts[i].y + ny };
      right[i] = { x: pts[i].x - nx, y: pts[i].y - ny };
   }
   const rightRev = right.slice().reverse();

   // Rounded end caps: cubic beziers bulging along the stroke's tangent, so the ends read soft, not chopped.
   const k = 4 / 3;
   const hwEnd = half * smooth[m - 1];
   const hwStart = half * smooth[0];
   const teX = Math.cos(heading[m - 1]) * hwEnd * k;
   const teY = Math.sin(heading[m - 1]) * hwEnd * k;
   const tsX = Math.cos(heading[0]) * hwStart * k;
   const tsY = Math.sin(heading[0]) * hwStart * k;

   let d = `M ${left[0].x} ${left[0].y}`;
   d += bezierSegments(left); // down the left edge
   d += ` C ${left[m - 1].x + teX} ${left[m - 1].y + teY} ${right[m - 1].x + teX} ${right[m - 1].y + teY} ${right[m - 1].x} ${right[m - 1].y}`; // end cap
   d += bezierSegments(rightRev); // back up the right edge
   d += ` C ${right[0].x - tsX} ${right[0].y - tsY} ${left[0].x - tsX} ${left[0].y - tsY} ${left[0].x} ${left[0].y}`; // start cap
   d += ' Z';
   return d;
}

/**
 * A crisp polyline path over a flat `[x0,y0,...]` point list - straight `M`/`L` segments, no smoothing (the
 * geometric counterpart to {@link buildStrokePath}). An empty list yields no path; a single point yields a
 * round-capped dot; `closed` appends a `Z` so the last vertex joins the first.
 */
export function buildPolylinePath(points: number[], closed: boolean): string {
   const count = Math.floor(points.length / 2);
   if (count === 0) return '';
   if (count === 1) return `M ${points[0]} ${points[1]} L ${points[0]} ${points[1]}`;
   let d = `M ${points[0]} ${points[1]}`;
   for (let i = 1; i < count; i++) d += ` L ${points[i * 2]} ${points[i * 2 + 1]}`;
   if (closed) d += ' Z';
   return d;
}

/**
 * The GEOMETRIC calligraphy-nib ribbon over a flat `[x0,y0,...]` vertex list - the crisp counterpart to
 * {@link buildBrushRibbonPath} (no resample, no heading smoothing). Each EDGE keeps its own straight
 * direction, and that direction alone sets its width: `hw = (baseWidth/2) * lerp(BRUSH_MIN_WIDTH_FACTOR, 1,
 * |sin(edgeHeading - nibAngle)|)`. So a single straight line reads as one uniform nib-weight for its angle,
 * while a polygon varies edge-to-edge. Every edge is a filled quad (its endpoints offset +/-hw along the
 * edge normal); a filled disc at each vertex, sized to the max of its adjacent edges' half-widths, bridges
 * the corner width mismatch (the nonzero fill hides the overlaps - the same trick the freehand ribbon uses).
 * `closed` adds the wrap edge (last->first). A lone point is a full-width round dot. Painted with `fill`,
 * no stroke. Render-only: the stored stroke keeps its raw vertices + width, so hit-test/bounds are unaffected.
 */
export function buildGeometricRibbonPath(points: number[], baseWidth: number, nibAngle: number, closed: boolean): string {
   const count = Math.floor(points.length / 2);
   if (count === 0) return '';
   const half = baseWidth / 2;
   const vx = (i: number) => points[i * 2];
   const vy = (i: number) => points[i * 2 + 1];
   const disc = (x: number, y: number, r: number) => {
      const rr = Math.max(r, 0.01);
      return `M ${x - rr} ${y} a ${rr} ${rr} 0 1 0 ${rr * 2} 0 a ${rr} ${rr} 0 1 0 ${-rr * 2} 0 Z`;
   };
   if (count === 1) return disc(vx(0), vy(0), half);

   const range = 1 - BRUSH_MIN_WIDTH_FACTOR;
   const edgeCount = closed ? count : count - 1;
   const vertexHw = new Array<number>(count).fill(0); // widest edge incident to each vertex, sizing its disc
   let d = '';
   for (let e = 0; e < edgeCount; e++) {
      const a = e;
      const b = (e + 1) % count;
      const ax = vx(a), ay = vy(a), bx = vx(b), by = vy(b);
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-9) continue; // coincident endpoints: no quad; the vertex disc still covers the point
      const heading = Math.atan2(by - ay, bx - ax);
      const hw = half * (BRUSH_MIN_WIDTH_FACTOR + range * Math.abs(Math.sin(heading - nibAngle)));
      // The unit normal to the edge, scaled to the half-width: (-sin, cos).
      const nx = -Math.sin(heading) * hw;
      const ny = Math.cos(heading) * hw;
      d += `M ${ax + nx} ${ay + ny} L ${bx + nx} ${by + ny} L ${bx - nx} ${by - ny} L ${ax - nx} ${ay - ny} Z`;
      if (hw > vertexHw[a]) vertexHw[a] = hw;
      if (hw > vertexHw[b]) vertexHw[b] = hw;
   }
   for (let i = 0; i < count; i++) if (vertexHw[i] > 0) d += disc(vx(i), vy(i), vertexHw[i]);
   // Every edge degenerate (all points coincident): fall back to a lone dot.
   return d || disc(vx(0), vy(0), half);
}

/**
 * Snaps the A->B direction to the nearest multiple of `stepRad`, keeping the segment's length. Used for the
 * shape tools' angle constraint (Shift). A zero-length segment has no direction, so B is returned unchanged.
 */
export function snapAngle(ax: number, ay: number, bx: number, by: number, stepRad: number): { x: number; y: number } {
   const dx = bx - ax;
   const dy = by - ay;
   const len = Math.hypot(dx, dy);
   if (len === 0) return { x: bx, y: by };
   const snapped = Math.round(Math.atan2(dy, dx) / stepRad) * stepRad;
   return { x: ax + Math.cos(snapped) * len, y: ay + Math.sin(snapped) * len };
}

/** The shortest a Line may be, in world px: a shorter one is a click with no real drag, dropped as a stray dot. */
export const MIN_LINE_LENGTH = 3;

/** True when a line's two endpoints sit within `min` world px - a near-zero drag to discard on commit. */
export function isLineDegenerate(points: number[], min: number): boolean {
   if (points.length < 4) return true;
   return Math.hypot(points[2] - points[0], points[3] - points[1]) < min;
}

/** The paint a stroke resolves to: its path plus the fill/stroke attributes for one `<path>`. */
export interface StrokePaint {
   d: string;
   fill: string;
   stroke: string;
   strokeWidth?: number;
   strokeOpacity?: number;
}

/** The stroke fields the paint helper reads (so a live preview can pass a transient, id-less stroke). */
export type StrokePaintInput = Pick<Stroke, 'brush' | 'color' | 'width' | 'points' | 'shape'>;

/**
 * Resolves a stroke to a single `<path>`'s paint, the ONE place the brush x shape matrix branches (so the
 * drawing item and the live preview render identically). A geometric brush stroke is a filled nib ribbon; a
 * geometric pen/highlighter is a crisp stroked polyline (the highlighter keeps its translucency); a freehand
 * brush stroke is the smoothed nib ribbon; a freehand pen/highlighter is the smoothed stroked path. A polygon
 * closes its path.
 */
export function strokePaint(stroke: StrokePaintInput): StrokePaint {
   const closed = stroke.shape === 'polygon';
   const ink = strokeColorToCss(stroke.color);
   if (stroke.shape) {
      if (stroke.brush === 'brush') {
         return { d: buildGeometricRibbonPath(stroke.points, stroke.width, NIB_ANGLE, closed), fill: ink, stroke: 'none' };
      }
      return { d: buildPolylinePath(stroke.points, closed), fill: 'none', stroke: ink, strokeWidth: stroke.width, strokeOpacity: brushOpacity(stroke.brush) };
   }
   if (stroke.brush === 'brush') {
      return { d: buildBrushRibbonPath(stroke.points, stroke.width, NIB_ANGLE), fill: ink, stroke: 'none' };
   }
   return { d: buildStrokePath(stroke.points), fill: 'none', stroke: ink, strokeWidth: stroke.width, strokeOpacity: brushOpacity(stroke.brush) };
}

/** A fresh stroke over a flat point list, carrying its brush, ink, width, and (for a geometric stroke) shape. */
export function makeStroke(id: string, points: number[], brush: BrushKind, color: string | null, width: number, shape?: Stroke['shape']): Stroke {
   const stroke: Stroke = { id, brush, color, width, points };
   if (shape) stroke.shape = shape;
   return stroke;
}

/** A fresh pen stroke with the default width and adaptive ink. */
export function makePenStroke(id: string, points: number[]): Stroke {
   return makeStroke(id, points, 'pen', null, DEFAULT_STROKE_WIDTH);
}

/** Squared distance from point (px,py) to the segment (ax,ay)-(bx,by). A zero-length segment reads as its endpoint. */
function pointSegmentDistanceSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
   const dx = bx - ax;
   const dy = by - ay;
   const lenSq = dx * dx + dy * dy;
   if (lenSq === 0) {
      const ex = px - ax;
      const ey = py - ay;
      return ex * ex + ey * ey;
   }
   let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
   t = Math.max(0, Math.min(1, t));
   const cx = ax + t * dx;
   const cy = ay + t * dy;
   const ex = px - cx;
   const ey = py - cy;
   return ex * ex + ey * ey;
}

/**
 * True when a world point lands on a stroke's inked band: the point-to-polyline distance over the stroke's
 * RAW sample points (not the smoothed bezier - cheaper, close enough for a scrub) is within half the stroke
 * width plus `tolerance`. `item` supplies the layer origin, since points are layer-local; the test runs in
 * world space. A point-only stroke tests against that single point; an empty stroke never hits.
 */
export function strokeHitsPoint(item: { x: number; y: number }, stroke: Stroke, worldX: number, worldY: number, tolerance: number): boolean {
   const points = stroke.points;
   const count = Math.floor(points.length / 2);
   if (count === 0) return false;
   const reach = stroke.width / 2 + tolerance;
   const reachSq = reach * reach;
   const localX = worldX - item.x;
   const localY = worldY - item.y;
   if (count === 1) {
      const ex = localX - points[0];
      const ey = localY - points[1];
      return ex * ex + ey * ey <= reachSq;
   }
   for (let i = 0; i < count - 1; i++) {
      if (pointSegmentDistanceSq(localX, localY, points[i * 2], points[i * 2 + 1], points[i * 2 + 2], points[i * 2 + 3]) <= reachSq) return true;
   }
   return false;
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

/**
 * Shrinks a drawing layer after SEVERAL strokes are removed (an erase gesture's forward step): drops every
 * stroke whose id is in the set, re-fits the box to the survivors, and re-bases them to the tightened origin.
 * The multi-stroke {@link recomputeDrawingBoxWithout}. All strokes removed yields a zero box holding none -
 * the caller deletes the emptied layer instead of keeping it.
 */
export function recomputeDrawingBoxWithoutMany(item: DrawingBox, strokeIds: Set<string>): DrawingBoxResult {
   const remaining = item.content.strokes.filter((stroke) => !strokeIds.has(stroke.id));
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
