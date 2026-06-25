// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { radialOffset, ringRadius } from './radialMenu';

/*
 * Ring-angle math: button i of n sits evenly around the circle, the first at the top (12 o'clock),
 * running clockwise. Only the pure geometry is tested; the rest of the menu is render/interaction.
 */

describe('radialOffset', () => {
   it('places the first button at the top (0, -radius)', () => {
      const { x, y } = radialOffset(0, 6, 72);
      expect(x).toBeCloseTo(0);
      expect(y).toBeCloseTo(-72);
   });

   it('runs clockwise: the second of four sits at the right (radius, 0)', () => {
      const { x, y } = radialOffset(1, 4, 72);
      expect(x).toBeCloseTo(72);
      expect(y).toBeCloseTo(0);
   });

   it('spaces all buttons on the circle of the given radius', () => {
      const radius = 72;
      for (let i = 0; i < 8; i++) {
         const { x, y } = radialOffset(i, 8, radius);
         expect(Math.hypot(x, y)).toBeCloseTo(radius);
      }
   });

   it('puts the bottom button at (0, radius) for an even count', () => {
      const { x, y } = radialOffset(2, 4, 72); // quarter-turn x2 from the top -> bottom
      expect(x).toBeCloseTo(0);
      expect(y).toBeCloseTo(72);
   });

   it('rotates the whole ring by angleOffsetDeg (the conveyor sweep)', () => {
      // The top button (i=0) rotated +90deg clockwise lands at the right (radius, 0).
      const { x, y } = radialOffset(0, 6, 72, 90);
      expect(x).toBeCloseTo(72);
      expect(y).toBeCloseTo(0);
   });

   it('stays on the circle for any angle offset, and matches the 3-arg call at offset 0', () => {
      const radius = 72;
      for (let i = 0; i < 6; i++) {
         const swept = radialOffset(i, 6, radius, 24);
         expect(Math.hypot(swept.x, swept.y)).toBeCloseTo(radius);
         expect(radialOffset(i, 6, radius, 0)).toEqual(radialOffset(i, 6, radius)); // back-compatible default
      }
   });
});

describe('ringRadius', () => {
   it('keeps a tight ring for a handful of options (so a small root is not flung wide)', () => {
      // 1-3 options clamp to the minimum radius rather than spreading across a big circle.
      expect(ringRadius(1)).toBe(48);
      expect(ringRadius(3)).toBe(48);
   });

   it('opens the ring up as options are added, holding a roughly constant gap', () => {
      expect(ringRadius(6)).toBeGreaterThan(ringRadius(3));
      expect(ringRadius(8)).toBeGreaterThan(ringRadius(6));
   });

   it('never grows beyond the cap', () => {
      expect(ringRadius(40)).toBeLessThanOrEqual(110);
   });

   it('keeps a tight, cohesive cluster for the realistic menu sizes (no scatter)', () => {
      // The "Board Elements" submenu has 6 options; its ring should be snug, not flung wide.
      expect(ringRadius(6)).toBeLessThanOrEqual(56);
   });

   it('never overlaps the 40px buttons at any realistic count', () => {
      const BUTTON_SIZE = 40;
      for (let n = 2; n <= 12; n++) {
         // The chord between two adjacent buttons must stay at least a button wide (centers apart).
         const chord = 2 * ringRadius(n) * Math.sin(Math.PI / n);
         expect(chord).toBeGreaterThanOrEqual(BUTTON_SIZE);
      }
   });
});
