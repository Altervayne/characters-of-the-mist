import { describe, expect, it } from 'vitest';

import { applyStatusTier } from './applyStatusTier';

const empty = () => Array(6).fill(false) as boolean[];

/*
 * The Mist Engine bubble-up rule: individual boxes, tick-or-bubble, maxed no-op, out-of-range guard.
 */

describe('applyStatusTier', () => {
   it('walks the worked example for `burned`', () => {
      let tiers = empty();
      tiers = applyStatusTier(tiers, 2);
      expect(tiers).toEqual([false, true, false, false, false, false]);
      tiers = applyStatusTier(tiers, 4);
      expect(tiers).toEqual([false, true, false, true, false, false]);
      tiers = applyStatusTier(tiers, 2);
      expect(tiers).toEqual([false, true, true, true, false, false]);
      tiers = applyStatusTier(tiers, 2);
      expect(tiers).toEqual([false, true, true, true, true, false]);
   });

   it('ticks only the target box (not cumulative) for a fresh status', () => {
      expect(applyStatusTier(empty(), 2)).toEqual([false, true, false, false, false, false]);
   });

   it('is a no-op when the target and every box above it are already ticked', () => {
      const maxed = [false, true, true, true, true, true];
      expect(applyStatusTier(maxed, 2)).toEqual(maxed);
   });

   it('is a no-op for an out-of-range tier', () => {
      expect(applyStatusTier(empty(), 0)).toEqual(empty());
      expect(applyStatusTier(empty(), 7)).toEqual(empty());
   });

   it('does not mutate the input array', () => {
      const input = empty();
      applyStatusTier(input, 3);
      expect(input).toEqual(empty());
   });
});
