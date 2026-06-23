// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { hexToRgb, readableTextColor } from './color';

const DARK_TEXT = '#1c1917';
const LIGHT_TEXT = '#f5f5f4';

describe('hexToRgb', () => {
   it('parses with and without the leading #', () => {
      expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
      expect(hexToRgb('ff8800')).toEqual([255, 136, 0]);
   });

   it('returns null for a malformed hex', () => {
      expect(hexToRgb('#xyz')).toBeNull();
      expect(hexToRgb('#fff')).toBeNull(); // shorthand is not supported
   });
});

describe('readableTextColor', () => {
   it('uses dark text on light pastels', () => {
      expect(readableTextColor('#fde68a')).toBe(DARK_TEXT); // the default amber
      expect(readableTextColor('#ffffff')).toBe(DARK_TEXT);
      expect(readableTextColor('#bfdbfe')).toBe(DARK_TEXT);
   });

   it('uses light text on dark custom colors', () => {
      expect(readableTextColor('#000000')).toBe(LIGHT_TEXT);
      expect(readableTextColor('#1e3a8a')).toBe(LIGHT_TEXT); // a dark blue
      expect(readableTextColor('#7f1d1d')).toBe(LIGHT_TEXT); // a dark red
   });

   it('falls back to dark text on an unparseable color', () => {
      expect(readableTextColor('not-a-color')).toBe(DARK_TEXT);
   });
});
