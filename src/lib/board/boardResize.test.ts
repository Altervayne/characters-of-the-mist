// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { MIN_ITEM_SIZE, computeResize, effectiveHeight } from './boardResize';

/*
 * Resize math: the bottom-right grip grows width/height with x/y pinned, and a min-height item
 * (its content height passed as the floor) can be dragged taller but never shorter than content.
 */

const orig = { x: 10, y: 20, width: 200, height: 150 };

describe('computeResize', () => {
   it('grows width and height by the delta, leaving x/y fixed', () => {
      expect(computeResize(orig, { x: 40, y: 30 })).toEqual({ x: 10, y: 20, width: 240, height: 180 });
   });

   it('floors width and height at MIN_ITEM_SIZE for an ordinary item', () => {
      const result = computeResize(orig, { x: -1000, y: -1000 });
      expect(result.width).toBe(MIN_ITEM_SIZE);
      expect(result.height).toBe(MIN_ITEM_SIZE);
   });

   it('clamps height to the content floor: a min-height item cannot be dragged shorter than its content', () => {
      const contentHeight = 130;
      // A big negative vertical drag stops at the content height, not at MIN_ITEM_SIZE.
      const result = computeResize(orig, { x: 0, y: -1000 }, { height: contentHeight });
      expect(result.height).toBe(contentHeight);
   });

   it('lets a min-height item be dragged taller than its content', () => {
      const result = computeResize(orig, { x: 0, y: 90 }, { height: 130 });
      expect(result.height).toBe(240); // 150 + 90, above the floor
   });

   it('clamps width to a custom floor (a zone cannot shrink below its member extent)', () => {
      const result = computeResize(orig, { x: -1000, y: -1000 }, { width: 160, height: 120 });
      expect(result.width).toBe(160);
      expect(result.height).toBe(120);
   });

   it('still floors the other axis at MIN_ITEM_SIZE when only one is given', () => {
      const result = computeResize(orig, { x: -1000, y: -1000 }, { width: 160 });
      expect(result.width).toBe(160);
      expect(result.height).toBe(MIN_ITEM_SIZE);
   });
});

describe('effectiveHeight', () => {
   it('renders at the content height when content exceeds the stored height (auto-grow floor)', () => {
      expect(effectiveHeight(150, 220)).toBe(220);
   });

   it('keeps the larger stored height when the user dragged it taller than the content', () => {
      expect(effectiveHeight(300, 220)).toBe(300);
   });
});
