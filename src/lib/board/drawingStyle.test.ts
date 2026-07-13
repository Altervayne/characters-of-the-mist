// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { DEFAULT_STROKE_WIDTH, appendStrokeToDrawing, buildStrokePath, makePenStroke, pointsBounds, rebasePoints, recomputeDrawingBoxWithout, strokeColorToCss } from './drawingStyle';

// -- Type Imports --
import type { DrawingBoardContent, Stroke } from '@/lib/types/board';

/** A layer-local stroke fixture (only the fields the box math reads matter). */
function stroke(id: string, points: number[]): Stroke {
   return { id, brush: 'pen', color: null, width: DEFAULT_STROKE_WIDTH, points };
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
