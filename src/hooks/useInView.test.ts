// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { computeLatch } from './useInView';

const entry = (isIntersecting: boolean) => ({ isIntersecting }) as IntersectionObserverEntry;

describe('computeLatch', () => {
   it('stays false while nothing intersects', () => {
      expect(computeLatch(false, [entry(false)])).toBe(false);
   });

   it('flips true once any entry intersects', () => {
      expect(computeLatch(false, [entry(false), entry(true)])).toBe(true);
   });

   it('stays true once latched, even when no longer intersecting', () => {
      expect(computeLatch(true, [entry(false)])).toBe(true);
   });
});
