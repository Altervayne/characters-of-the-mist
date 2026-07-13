// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { BRUSH_MIN_WIDTH_FACTOR, DEFAULT_STROKE_WIDTH, MIN_LINE_LENGTH, NIB_ANGLE, appendStrokeToDrawing, brushOpacity, buildBrushRibbonPath, buildGeometricRibbonPath, buildPolylinePath, buildStrokePath, isLineDegenerate, makePenStroke, makeStroke, pointsBounds, rebasePoints, recomputeDrawingBoxWithout, recomputeDrawingBoxWithoutMany, snapAngle, strokeColorToCss, strokeHitsPoint, strokePaint } from './drawingStyle';

// -- Type Imports --
import type { BrushKind, DrawingBoardContent, Stroke } from '@/lib/types/board';

/** A layer-local stroke fixture (only the fields the box math reads matter). Defaults to a pen stroke. */
function stroke(id: string, points: number[], brush: BrushKind = 'pen', width: number = DEFAULT_STROKE_WIDTH): Stroke {
   return { id, brush, color: null, width, points };
}

/** A minimal drawing layer at an origin, holding the given layer-local strokes. */
function layer(x: number, y: number, strokes: Stroke[]): { x: number; y: number; content: DrawingBoardContent } {
   return { x, y, content: { kind: 'drawing', strokes } };
}

/*
 * The pure geometry + style helpers behind a drawing layer: adaptive ink resolution, world bounds (for
 * minting a layer's origin), world<->local rebasing (so an append never touches the box), and the smoothed
 * path builder that turns raw samples into a curve. Kept free of React so they are unit-testable here.
 */

describe('strokeColorToCss', () => {
   it('resolves null to the adaptive theme foreground and passes a hex through', () => {
      expect(strokeColorToCss(null)).toBe('var(--foreground)');
      expect(strokeColorToCss('#ff0000')).toBe('#ff0000');
   });
});

describe('pointsBounds', () => {
   it('returns the min/max corners over a flat point list', () => {
      expect(pointsBounds([10, 20, -5, 40, 30, 15])).toEqual({ minX: -5, minY: 15, maxX: 30, maxY: 40 });
   });

   it('returns null when there is no point', () => {
      expect(pointsBounds([])).toBeNull();
   });
});

describe('rebasePoints', () => {
   it('subtracts the origin from every pair (world -> local)', () => {
      expect(rebasePoints([10, 20, 30, 40], 10, 20)).toEqual([0, 0, 20, 20]);
   });

   it('round-trips through a negated origin', () => {
      const local = rebasePoints([10, 20, 30, 40], 10, 20);
      expect(rebasePoints(local, -10, -20)).toEqual([10, 20, 30, 40]);
   });
});

describe('buildStrokePath', () => {
   it('is empty for no points', () => {
      expect(buildStrokePath([])).toBe('');
   });

   it('draws a zero-length segment (a dot) for a single point', () => {
      expect(buildStrokePath([5, 7])).toBe('M 5 7 L 5 7');
   });

   it('opens with a move to the first point and emits a bezier per following point', () => {
      const path = buildStrokePath([0, 0, 10, 10, 20, 0]);
      expect(path.startsWith('M 0 0')).toBe(true);
      expect(path.match(/C/g)?.length).toBe(2); // one cubic segment per step between three points
   });
});

describe('makePenStroke', () => {
   it('mints a pen stroke with the default width and the adaptive (null) color', () => {
      const pen = makePenStroke('s1', [0, 0, 1, 1]);
      expect(pen).toEqual({ id: 's1', brush: 'pen', color: null, width: DEFAULT_STROKE_WIDTH, points: [0, 0, 1, 1] });
   });
});

describe('makeStroke', () => {
   it('carries the given brush, ink, and width', () => {
      expect(makeStroke('s1', [0, 0, 2, 2], 'highlighter', '#ff0000', 16)).toEqual({ id: 's1', brush: 'highlighter', color: '#ff0000', width: 16, points: [0, 0, 2, 2] });
   });

   it('stamps a shape only when one is passed (freehand stays shape-less)', () => {
      expect(makeStroke('s1', [0, 0, 2, 2], 'pen', null, 3)).not.toHaveProperty('shape');
      expect(makeStroke('s2', [0, 0, 2, 2], 'pen', null, 3, 'line').shape).toBe('line');
      expect(makeStroke('s3', [0, 0, 2, 2, 4, 0], 'pen', null, 3, 'polygon').shape).toBe('polygon');
   });
});

describe('buildPolylinePath', () => {
   it('is empty for no points', () => {
      expect(buildPolylinePath([], false)).toBe('');
   });

   it('draws a round-capped dot for a single point', () => {
      expect(buildPolylinePath([5, 7], false)).toBe('M 5 7 L 5 7');
   });

   it('emits straight line-tos with no smoothing', () => {
      expect(buildPolylinePath([0, 0, 10, 10], false)).toBe('M 0 0 L 10 10');
      expect(buildPolylinePath([0, 0, 10, 10, 20, 0], false)).toBe('M 0 0 L 10 10 L 20 0');
   });

   it('appends Z only when closed', () => {
      expect(buildPolylinePath([0, 0, 10, 10, 20, 0], true)).toBe('M 0 0 L 10 10 L 20 0 Z');
      expect(/Z/.test(buildPolylinePath([0, 0, 10, 10, 20, 0], false))).toBe(false);
   });
});

describe('buildGeometricRibbonPath', () => {
   // The bbox of the first edge quad only (up to its closing Z), so the vertex discs' relative arc deltas
   // never pollute the thickness measurement.
   const firstQuadBounds = (d: string) => {
      const nums = (d.slice(0, d.indexOf('Z')).match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []).map(Number);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < nums.length - 1; i += 2) {
         minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
         minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
      }
      return { minX, minY, maxX, maxY };
   };

   it('is empty for no points', () => {
      expect(buildGeometricRibbonPath([], 10, NIB_ANGLE, false)).toBe('');
   });

   it('draws a full-width round dot for a single point', () => {
      const d = buildGeometricRibbonPath([5, 5], 10, NIB_ANGLE, false);
      expect(d.match(/a/g)?.length).toBe(2); // two arcs close the disc
   });

   it('emits one filled quad for a single straight edge (no smoothing)', () => {
      const d = buildGeometricRibbonPath([0, 0, 20, 0], 10, NIB_ANGLE, false);
      expect((d.match(/ L /g) ?? []).length).toBe(3); // a quad is three line-tos after the move
      expect(d.includes('C')).toBe(false); // geometric: never a curve
   });

   it('varies width by edge direction (a horizontal and a vertical edge differ, within the nib range)', () => {
      const width = 10;
      const h = firstQuadBounds(buildGeometricRibbonPath([0, 0, 20, 0], width, NIB_ANGLE, false)); // thickness is vertical
      const v = firstQuadBounds(buildGeometricRibbonPath([0, 0, 0, 20], width, NIB_ANGLE, false)); // thickness is horizontal
      const hThick = h.maxY - h.minY;
      const vThick = v.maxX - v.minX;
      expect(hThick).not.toBeCloseTo(vThick);
      for (const thick of [hThick, vThick]) {
         expect(thick).toBeGreaterThanOrEqual(width * BRUSH_MIN_WIDTH_FACTOR - 1e-6);
         expect(thick).toBeLessThanOrEqual(width + 1e-6);
      }
   });

   it('closes a triangle: three edge quads plus bridging discs', () => {
      const open = buildGeometricRibbonPath([0, 0, 20, 0, 10, 17], 10, NIB_ANGLE, false); // 2 edges
      const closed = buildGeometricRibbonPath([0, 0, 20, 0, 10, 17], 10, NIB_ANGLE, true); // + the wrap edge
      // Each quad is three line-tos; the closed form carries the extra closing edge.
      expect((closed.match(/ L /g) ?? []).length).toBe((open.match(/ L /g) ?? []).length + 3);
      expect(closed.includes('a')).toBe(true); // vertex discs bridge the corners
   });

   it('collapses to a lone dot when every point is coincident', () => {
      const d = buildGeometricRibbonPath([4, 4, 4, 4, 4, 4], 10, NIB_ANGLE, false);
      expect(d.match(/a/g)?.length).toBe(2); // no quad survives; a single disc remains
      expect(d.includes('L')).toBe(false);
   });
});

describe('snapAngle', () => {
   const step = Math.PI / 4; // 45deg

   it('snaps a near-diagonal to an exact 45deg, keeping the length', () => {
      const p = snapAngle(0, 0, 10, 6, step); // ~31deg -> 45deg
      expect(p.x).toBeCloseTo(p.y); // exactly on the 45deg diagonal
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(Math.hypot(10, 6)); // length preserved
   });

   it('leaves an already axis-aligned segment on its axis', () => {
      const p = snapAngle(0, 0, 12, 0.3, step); // ~1.4deg -> 0deg
      expect(p.x).toBeCloseTo(Math.hypot(12, 0.3));
      expect(p.y).toBeCloseTo(0);
   });

   it('returns the end unchanged for a zero-length segment (no direction)', () => {
      expect(snapAngle(5, 5, 5, 5, step)).toEqual({ x: 5, y: 5 });
   });
});

describe('isLineDegenerate', () => {
   it('flags a pure click (coincident endpoints)', () => {
      expect(isLineDegenerate([10, 10, 10, 10], MIN_LINE_LENGTH)).toBe(true);
   });

   it('flags a sub-threshold drag', () => {
      expect(isLineDegenerate([0, 0, MIN_LINE_LENGTH - 0.5, 0], MIN_LINE_LENGTH)).toBe(true);
   });

   it('passes a drag past the threshold', () => {
      expect(isLineDegenerate([0, 0, MIN_LINE_LENGTH + 1, 0], MIN_LINE_LENGTH)).toBe(false);
   });

   it('flags a point list too short to be a line', () => {
      expect(isLineDegenerate([0, 0], MIN_LINE_LENGTH)).toBe(true);
   });
});

describe('strokePaint', () => {
   it('paints a geometric brush stroke as a filled nib ribbon', () => {
      const paint = strokePaint({ brush: 'brush', color: null, width: 10, points: [0, 0, 20, 0], shape: 'line' });
      expect(paint.fill).toBe('var(--foreground)');
      expect(paint.stroke).toBe('none');
      expect(paint.d.includes('C')).toBe(false); // crisp, not smoothed
   });

   it('paints a geometric pen line as a crisp stroked polyline', () => {
      const paint = strokePaint({ brush: 'pen', color: '#ff0000', width: 3, points: [0, 0, 20, 0], shape: 'line' });
      expect(paint.fill).toBe('none');
      expect(paint.stroke).toBe('#ff0000');
      expect(paint.strokeWidth).toBe(3);
      expect(paint.d).toBe('M 0 0 L 20 0');
   });

   it('keeps the highlighter translucent and closes a polygon', () => {
      const paint = strokePaint({ brush: 'highlighter', color: null, width: 8, points: [0, 0, 10, 0, 5, 8], shape: 'polygon' });
      expect(paint.strokeOpacity).toBeCloseTo(0.4);
      expect(paint.d.trim().endsWith('Z')).toBe(true);
   });

   it('falls back to the freehand smoothed path when no shape is set', () => {
      const paint = strokePaint({ brush: 'pen', color: null, width: 3, points: [0, 0, 10, 10, 20, 0] });
      expect(paint.d.includes('C')).toBe(true); // smoothed bezier, not a crisp polyline
   });
});

describe('brushOpacity', () => {
   it('is translucent for the highlighter and opaque for pen/brush', () => {
      expect(brushOpacity('highlighter')).toBeCloseTo(0.4);
      expect(brushOpacity('pen')).toBe(1);
      expect(brushOpacity('brush')).toBe(1);
   });
});

describe('buildBrushRibbonPath', () => {
   // Every coordinate pair in a ribbon path (no arcs), so the perpendicular thickness can be measured.
   const bounds = (d: string) => {
      const nums = (d.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) ?? []).map(Number);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < nums.length - 1; i += 2) {
         minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
         minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
      }
      return { minX, minY, maxX, maxY };
   };

   it('is empty for no points', () => {
      expect(buildBrushRibbonPath([], 10, NIB_ANGLE)).toBe('');
   });

   it('draws a full-width round dot (an arc pair) for a single point', () => {
      const d = buildBrushRibbonPath([5, 5], 10, NIB_ANGLE);
      expect(d.startsWith('M')).toBe(true);
      expect(d.match(/a/g)?.length).toBe(2); // two arcs close the circle
      expect(d.trim().endsWith('Z')).toBe(true);
   });

   it('closes a curved filled ribbon (both edges + caps are beziers, no straight line-tos)', () => {
      const d = buildBrushRibbonPath([0, 0, 20, 0, 40, 0, 60, 0], 10, NIB_ANGLE);
      expect(d.startsWith('M')).toBe(true);
      expect(d.trim().endsWith('Z')).toBe(true);
      expect(/ L /.test(d)).toBe(false); // outline + caps are curved, never a serrating straight join
      expect((d.match(/C/g) ?? []).length).toBeGreaterThanOrEqual(4); // left edge, right edge, two caps
   });

   it('shrugs off a near-coincident (noise) sample - the resampled ribbon barely moves', () => {
      const clean = bounds(buildBrushRibbonPath([0, 0, 20, 0, 40, 0, 60, 0], 10, NIB_ANGLE));
      // The same stroke with a sub-pixel-jittered near-duplicate injected (the pointer noise that serrates).
      const noisy = bounds(buildBrushRibbonPath([0, 0, 20, 0, 20.2, 0.1, 40, 0, 60, 0], 10, NIB_ANGLE));
      expect(Math.abs((noisy.maxY - noisy.minY) - (clean.maxY - clean.minY))).toBeLessThan(0.5);
      expect(Math.abs(noisy.maxX - clean.maxX)).toBeLessThan(1);
   });

   it('gives a horizontal and a vertical stroke different widths (the nib is off 45deg)', () => {
      const width = 10;
      const h = bounds(buildBrushRibbonPath([0, 0, 10, 0], width, NIB_ANGLE)); // thickness is vertical
      const v = bounds(buildBrushRibbonPath([0, 0, 0, 10], width, NIB_ANGLE)); // thickness is horizontal
      const hThick = h.maxY - h.minY;
      const vThick = v.maxX - v.minX;
      expect(hThick).not.toBeCloseTo(vThick);
      // Both sit within the nib's range: never thinner than the floor, never wider than the base width.
      for (const thick of [hThick, vThick]) {
         expect(thick).toBeGreaterThanOrEqual(width * BRUSH_MIN_WIDTH_FACTOR - 1e-6);
         expect(thick).toBeLessThanOrEqual(width + 1e-6);
      }
   });

   it('is thinnest along the nib edge and fullest perpendicular to it', () => {
      const width = 10;
      const along = bounds(buildBrushRibbonPath([0, 0, Math.cos(NIB_ANGLE) * 10, Math.sin(NIB_ANGLE) * 10], width, NIB_ANGLE));
      const across = bounds(buildBrushRibbonPath([0, 0, Math.cos(NIB_ANGLE + Math.PI / 2) * 10, Math.sin(NIB_ANGLE + Math.PI / 2) * 10], width, NIB_ANGLE));
      const span = (b: { minX: number; minY: number; maxX: number; maxY: number }) => Math.max(b.maxX - b.minX, b.maxY - b.minY);
      // The perpendicular stroke's bbox is wider than the along-nib one (thin edge vs full edge).
      expect(span(across)).toBeGreaterThan(span(along));
   });
});

describe('strokeHitsPoint', () => {
   const origin = { x: 100, y: 100 }; // layer origin: local (0,0) == world (100,100)

   it('never hits an empty stroke', () => {
      expect(strokeHitsPoint(origin, stroke('s', []), 100, 100, 8)).toBe(false);
   });

   it('hits a single-point stroke within reach and misses beyond it', () => {
      const dot = stroke('s', [0, 0], 'pen', 4); // reach = width/2 + tol = 2 + 8 = 10
      expect(strokeHitsPoint(origin, dot, 108, 100, 8)).toBe(true); // 8px away, inside 10
      expect(strokeHitsPoint(origin, dot, 120, 100, 8)).toBe(false); // 20px away, outside
   });

   it('hits along a segment (perpendicular distance) and misses a near-miss just past the band', () => {
      const line = stroke('s', [0, 0, 40, 0], 'pen', 4); // horizontal, reach 10 with tol 8
      expect(strokeHitsPoint(origin, line, 120, 108, 8)).toBe(true); // 8px off the line, inside
      expect(strokeHitsPoint(origin, line, 120, 112, 8)).toBe(false); // 12px off, outside
   });

   it('widens the hit band for a thick stroke', () => {
      const near = { worldX: 120, worldY: 118 }; // 18px off the line
      const thin = stroke('s', [0, 0, 40, 0], 'pen', 4); // reach 10
      const thick = stroke('s', [0, 0, 40, 0], 'highlighter', 20); // reach = 10 + 8 = 18
      expect(strokeHitsPoint(origin, thin, near.worldX, near.worldY, 8)).toBe(false);
      expect(strokeHitsPoint(origin, thick, near.worldX, near.worldY, 8)).toBe(true);
   });
});

describe('recomputeDrawingBoxWithoutMany', () => {
   it('drops several strokes, re-fits the box, and re-bases the survivors', () => {
      // origin (-5,-8): survivor s1 at world (0,0)-(10,10); s2/s3 reach up/left and are erased.
      const item = layer(-5, -8, [stroke('s1', [5, 8, 15, 18]), stroke('s2', [0, 0, 8, 11]), stroke('s3', [0, 0, 1, 1])]);
      const next = recomputeDrawingBoxWithoutMany(item, new Set(['s2', 's3']));
      expect(next).toEqual({ x: 0, y: 0, width: 10, height: 10, strokes: [stroke('s1', [0, 0, 10, 10])] });
   });

   it('returns a zero box holding no stroke when every stroke is removed', () => {
      const item = layer(0, 0, [stroke('s1', [0, 0, 10, 10]), stroke('s2', [3, 3, 4, 4])]);
      expect(recomputeDrawingBoxWithoutMany(item, new Set(['s1', 's2']))).toEqual({ x: 0, y: 0, width: 0, height: 0, strokes: [] });
   });
});

describe('appendStrokeToDrawing', () => {
   const mint = (id: string) => (points: number[]) => stroke(id, points);

   it('grows width/height without re-basing when the stroke stays below/right of the origin', () => {
      const item = layer(0, 0, [stroke('s1', [0, 0, 10, 10])]);
      const next = appendStrokeToDrawing(item, [5, 5, 20, 20], mint('s2'));
      expect(next).toEqual({
         x: 0,
         y: 0,
         width: 20,
         height: 20,
         // The existing stroke is untouched (same object contents); the new one lands local to the held origin.
         strokes: [stroke('s1', [0, 0, 10, 10]), stroke('s2', [5, 5, 20, 20])],
      });
   });

   it('shifts the origin up/left and re-bases every stroke, holding the ink still on screen', () => {
      const item = layer(0, 0, [stroke('s1', [0, 0, 10, 10])]);
      const next = appendStrokeToDrawing(item, [-5, -8, 3, 3], mint('s2'));
      expect(next).toEqual({
         x: -5,
         y: -8,
         width: 15,
         height: 18,
         strokes: [stroke('s1', [5, 8, 15, 18]), stroke('s2', [0, 0, 8, 11])],
      });
      // Ink is world-stable: local + new origin recovers each stroke's original world coords.
      expect(rebasePoints(next.strokes[0].points, -next.x, -next.y)).toEqual([0, 0, 10, 10]);
      expect(rebasePoints(next.strokes[1].points, -next.x, -next.y)).toEqual([-5, -8, 3, 3]);
   });

   it('appends against a non-zero layer origin by converting the world stroke into the local frame', () => {
      const item = layer(100, 100, [stroke('s1', [0, 0, 10, 10])]); // world (100,100)-(110,110)
      const next = appendStrokeToDrawing(item, [105, 105, 130, 130], mint('s2'));
      expect(next).toEqual({
         x: 100,
         y: 100,
         width: 30,
         height: 30,
         strokes: [stroke('s1', [0, 0, 10, 10]), stroke('s2', [5, 5, 30, 30])],
      });
   });
});

describe('recomputeDrawingBoxWithout', () => {
   it('re-fits the box to the remaining strokes and re-bases them (the inverse of an up/left append)', () => {
      // The layer left by the up/left append above: origin (-5,-8), two strokes.
      const item = layer(-5, -8, [stroke('s1', [5, 8, 15, 18]), stroke('s2', [0, 0, 8, 11])]);
      const next = recomputeDrawingBoxWithout(item, 's2');
      expect(next).toEqual({ x: 0, y: 0, width: 10, height: 10, strokes: [stroke('s1', [0, 0, 10, 10])] });
   });

   it('leaves the box untouched when the removed stroke was inside the extent', () => {
      const item = layer(0, 0, [stroke('s1', [0, 0, 10, 10]), stroke('s2', [3, 3, 4, 4])]);
      const next = recomputeDrawingBoxWithout(item, 's2');
      expect(next).toEqual({ x: 0, y: 0, width: 10, height: 10, strokes: [stroke('s1', [0, 0, 10, 10])] });
   });
});
