// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Unit Under Test --
import { besidePlacement } from './spawnBesideItem';

/*
 * The pure placement rule for spawn-beside: an element drops to the RIGHT of the origin tile with a gap,
 * top-aligned, and nudges diagonally when it would land exactly on an existing item so repeated spawns fan
 * out instead of stacking. The board read + `addItem` around it are covered by the live preview, not here.
 */

const ORIGIN = { x: 100, y: 200, width: 260, height: 320 };
const SPEC = { width: 250, height: 600 };

describe('besidePlacement', () => {
   it('places the element to the right of the origin, top-aligned, at the spec size', () => {
      const placement = besidePlacement(ORIGIN, SPEC, []);
      // x = origin.x + origin.width + GAP(24); y = origin.y.
      expect(placement).toEqual({ x: 384, y: 200, width: 250, height: 600 });
   });

   it('nudges diagonally when an item already sits at the beside slot', () => {
      const occupied = { x: 384, y: 200, width: 250, height: 600 };
      const placement = besidePlacement(ORIGIN, SPEC, [occupied]);
      // One collision -> one 24px diagonal shove.
      expect(placement).toMatchObject({ x: 408, y: 224 });
   });

   it('keeps nudging past a stack until it finds a free slot', () => {
      const stack = [
         { x: 384, y: 200, width: 250, height: 600 },
         { x: 408, y: 224, width: 250, height: 600 },
      ];
      const placement = besidePlacement(ORIGIN, SPEC, stack);
      expect(placement).toMatchObject({ x: 432, y: 248 });
   });

   it('ignores items that are not at the beside slot', () => {
      const elsewhere = { x: 999, y: 999, width: 10, height: 10 };
      const placement = besidePlacement(ORIGIN, SPEC, [elsewhere]);
      expect(placement).toMatchObject({ x: 384, y: 200 });
   });
});
