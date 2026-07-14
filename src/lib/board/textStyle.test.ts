// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   DEFAULT_TEXT_SIZE,
   MAX_TEXT_SIZE,
   MIN_TEXT_SIZE,
   TEXT_FONT_FAMILIES,
   TEXT_FONT_LABELS,
   TEXT_FONT_STACKS,
   TEXT_SIZE_PRESETS,
   defaultTextStyle,
   steppedTextSize,
   textStyleToCss,
} from './textStyle';

/*
 * Guards the pure text-typography helpers: the adaptive-color mapping (null -> the theme foreground token),
 * the style -> CSS translation, the font tables, and the clamped size stepper.
 */

describe('textStyleToCss', () => {
   it('maps a null color to the adaptive theme-foreground default', () => {
      expect(textStyleToCss(defaultTextStyle()).color).toBe('var(--foreground)');
   });

   it('uses a picked hex verbatim', () => {
      expect(textStyleToCss({ ...defaultTextStyle(), color: '#ff0000' }).color).toBe('#ff0000');
   });

   it('translates weight, italic, underline, align, and the bundled font stack', () => {
      const css = textStyleToCss({ color: null, fontFamily: 'serif', size: 32, weight: 'bold', italic: true, underline: true, align: 'center' });
      expect(css.fontWeight).toBe(700);
      expect(css.fontStyle).toBe('italic');
      expect(css.textDecoration).toBe('underline');
      expect(css.textAlign).toBe('center');
      expect(css.fontSize).toBe(32);
      expect(css.fontFamily).toBe(TEXT_FONT_STACKS.serif);
   });
});

describe('defaultTextStyle', () => {
   it('is adaptive, sans, default-sized, unemphasized, left-aligned', () => {
      expect(defaultTextStyle()).toEqual({ color: null, fontFamily: 'sans', size: DEFAULT_TEXT_SIZE, weight: 'normal', italic: false, underline: false, align: 'left' });
   });
});

describe('the font token tables', () => {
   it('lists the generic stacks first, then the display faces, with no duplicates', () => {
      expect(TEXT_FONT_FAMILIES).toEqual(['sans', 'serif', 'mono', 'handwriting', 'marker', 'rounded']);
      expect(new Set(TEXT_FONT_FAMILIES).size).toBe(TEXT_FONT_FAMILIES.length);
   });

   it('has a non-empty CSS stack and a label for every listed token', () => {
      for (const font of TEXT_FONT_FAMILIES) {
         expect(TEXT_FONT_STACKS[font]).toBeTruthy();
         expect(TEXT_FONT_LABELS[font]).toBeTruthy();
      }
   });

   it('names the self-hosted display face first in each display stack', () => {
      expect(TEXT_FONT_STACKS.handwriting).toContain("'Caveat'");
      expect(TEXT_FONT_STACKS.marker).toContain("'Permanent Marker'");
      expect(TEXT_FONT_STACKS.rounded).toContain("'Fredoka'");
   });
});

describe('the size presets', () => {
   it('includes the classic small sizes and stays sorted with no duplicates', () => {
      expect(TEXT_SIZE_PRESETS).toContain(7);
      expect(TEXT_SIZE_PRESETS).toContain(8);
      expect(TEXT_SIZE_PRESETS).toContain(10);
      expect([...TEXT_SIZE_PRESETS]).toEqual([...TEXT_SIZE_PRESETS].sort((a, b) => a - b));
      expect(new Set(TEXT_SIZE_PRESETS).size).toBe(TEXT_SIZE_PRESETS.length);
   });

   it('keeps every preset within the clamp bounds', () => {
      for (const preset of TEXT_SIZE_PRESETS) {
         expect(preset).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
         expect(preset).toBeLessThanOrEqual(MAX_TEXT_SIZE);
      }
   });
});

describe('steppedTextSize', () => {
   it('steps up to the next ladder value', () => {
      expect(steppedTextSize(24, 1)).toBe(32);
   });

   it('steps down to the previous ladder value', () => {
      expect(steppedTextSize(24, -1)).toBe(20);
   });

   it('steps from an off-ladder size to the nearest value in that direction', () => {
      expect(steppedTextSize(30, 1)).toBe(32);
      expect(steppedTextSize(30, -1)).toBe(24);
   });

   it('clamps at the bounds', () => {
      expect(steppedTextSize(MAX_TEXT_SIZE, 1)).toBe(MAX_TEXT_SIZE);
      expect(steppedTextSize(MIN_TEXT_SIZE, -1)).toBe(MIN_TEXT_SIZE);
   });
});
