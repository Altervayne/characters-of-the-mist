import { describe, expect, it } from 'vitest';

import { PORTAL_BASE_SIZE, PORTAL_MIN_SIZE, portalFontPx, portalIconPx, portalIconOnlyPx } from './portalSizing';

describe('portalSizing', () => {
   it('reproduces the 1a look at the base height', () => {
      expect(portalFontPx(PORTAL_BASE_SIZE.height)).toBe(14);
      expect(portalIconPx(PORTAL_BASE_SIZE.height)).toBe(20);
   });

   it('scales the font and icon up with a taller box', () => {
      expect(portalFontPx(80)).toBeGreaterThan(portalFontPx(PORTAL_BASE_SIZE.height));
      expect(portalIconPx(80)).toBeGreaterThan(portalIconPx(PORTAL_BASE_SIZE.height));
   });

   it('floors the font and icon so a min-height box stays legible', () => {
      expect(portalFontPx(PORTAL_MIN_SIZE.height)).toBeGreaterThanOrEqual(11);
      expect(portalIconPx(PORTAL_MIN_SIZE.height)).toBeGreaterThanOrEqual(14);
      // A degenerate/zero height never yields a zero (or negative) size.
      expect(portalFontPx(0)).toBe(11);
      expect(portalIconPx(0)).toBe(14);
   });

   it('caps the font and icon so a large box does not run away', () => {
      expect(portalFontPx(1000)).toBe(26);
      expect(portalIconPx(1000)).toBe(40);
   });

   it('sizes the icon-only glyph off the shorter side (square at any aspect)', () => {
      // A wide-but-short box scales off the short side, so it matches the same height as a square box.
      expect(portalIconOnlyPx(400, 48)).toBe(portalIconOnlyPx(48, 48));
      expect(portalIconOnlyPx(48, 400)).toBe(portalIconOnlyPx(48, 48));
   });

   it('clamps the icon-only glyph at both ends', () => {
      expect(portalIconOnlyPx(0, 0)).toBe(16);
      expect(portalIconOnlyPx(1000, 1000)).toBe(88);
   });
});
