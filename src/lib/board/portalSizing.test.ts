import { describe, expect, it } from 'vitest';

import { PORTAL_BASE_SIZE, PORTAL_MIN_SIZE, PORTAL_IMAGE_SIZE_DEFAULT, portalAlignFlexDirection, portalFontPx, portalIconPx, portalIconOnlyPx, portalImageThumbPx, portalLabelMaxLines } from './portalSizing';

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

   it('maps the label alignment to the composed layout flex direction', () => {
      // The label sits after the visual for `right`/`bottom` and before it for `left`/`top`.
      expect(portalAlignFlexDirection('right')).toBe('row');
      expect(portalAlignFlexDirection('left')).toBe('row-reverse');
      expect(portalAlignFlexDirection('bottom')).toBe('column');
      expect(portalAlignFlexDirection('top')).toBe('column-reverse');
   });

   it('scales the composed image thumbnail with both the box and the size fraction', () => {
      // A bigger fraction and a taller box both grow the thumbnail.
      expect(portalImageThumbPx(100, 0.8)).toBeGreaterThan(portalImageThumbPx(100, 0.4));
      expect(portalImageThumbPx(200, PORTAL_IMAGE_SIZE_DEFAULT)).toBeGreaterThan(portalImageThumbPx(100, PORTAL_IMAGE_SIZE_DEFAULT));
   });

   it('clamps the composed image thumbnail at both ends', () => {
      expect(portalImageThumbPx(0, 1)).toBe(12); // floor even at full fraction on a zero box
      expect(portalImageThumbPx(10000, 1)).toBe(600); // ceiling on a runaway box
      // A sub-floor fraction is clamped up before scaling (never a zero-size thumbnail).
      expect(portalImageThumbPx(100, 0)).toBe(portalImageThumbPx(100, 0.1));
   });

   it('derives the label line budget from the box height, always at least one line', () => {
      const font = portalFontPx(PORTAL_BASE_SIZE.height);
      // A short base box fits a line or two; a tall box fits more; the count is monotonic.
      expect(portalLabelMaxLines(PORTAL_BASE_SIZE.height, font)).toBeGreaterThanOrEqual(1);
      expect(portalLabelMaxLines(400, font)).toBeGreaterThan(portalLabelMaxLines(PORTAL_BASE_SIZE.height, font));
      // Reserving vertical space for a stacked visual shrinks the budget but never below one.
      expect(portalLabelMaxLines(120, font, 100)).toBeGreaterThanOrEqual(1);
      expect(portalLabelMaxLines(120, font, 100)).toBeLessThanOrEqual(portalLabelMaxLines(120, font, 0));
      // A degenerate box still yields one line, and the budget is capped.
      expect(portalLabelMaxLines(0, font)).toBe(1);
      expect(portalLabelMaxLines(100000, font)).toBe(6);
   });
});
