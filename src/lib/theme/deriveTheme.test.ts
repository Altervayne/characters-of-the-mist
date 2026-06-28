// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { derive2Seed, derive4Seed, deriveMode } from './deriveTheme';
import { CHROME_TOKEN_KEYS } from './themeTokens';
import { colorToHsl, contrastRatio, parseColorToRgb } from '@/lib/color';

// -- Type Imports --
import type { TokenSet } from './themeTokens';

/*
 * The bulletproof proof: across a wide seed grid (hues all around the wheel, lightnesses from near-black to
 * near-white, low + full saturation, incl. extremes) every derived palette is complete + parseable and the
 * required foreground/background pairs clear the AA floor. If a corner drops below, the derivation - not the
 * test - is wrong.
 */

/** WCAG AA for normal text. The derivation's pure-black/white auto-contrast guarantees ~4.58 worst case. */
const AA = 4.5;

/** Pairs that MUST stay legible no matter the seeds. */
const CONTRAST_PAIRS: [keyof TokenSet, keyof TokenSet][] = [
   ['foreground', 'background'],
   ['card-foreground', 'card'],
   ['popover-foreground', 'popover'],
   ['primary-foreground', 'primary'],
   ['destructive-foreground', 'destructive'],
];

/** A seed grid spanning the hue wheel and the lightness/saturation extremes. */
function seedGrid(): string[] {
   const seeds: string[] = [];
   for (let hue = 0; hue < 360; hue += 30) {
      for (const lightness of [4, 25, 50, 75, 96]) {
         for (const saturation of [8, 100]) {
            seeds.push(`hsl(${hue} ${saturation}% ${lightness}%)`);
         }
      }
   }
   return seeds;
}

const SEEDS = seedGrid();

describe('deriveMode', () => {
   it('produces a complete, parseable TokenSet for every key, in both modes', () => {
      for (const mode of ['light', 'dark'] as const) {
         const set = deriveMode('hsl(220 80% 50%)', 'hsl(220 30% 50%)', mode);
         for (const key of CHROME_TOKEN_KEYS) {
            expect(typeof set[key]).toBe('string');
            expect(parseColorToRgb(set[key])).not.toBeNull();
         }
      }
   });

   it('clears the AA floor on every required pair across the whole seed grid, both modes', () => {
      for (const accent of SEEDS) {
         for (const neutral of SEEDS) {
            for (const mode of ['light', 'dark'] as const) {
               const set = deriveMode(accent, neutral, mode);
               for (const [fg, bg] of CONTRAST_PAIRS) {
                  const ratio = contrastRatio(set[fg], set[bg]);
                  expect(ratio, `${mode} ${fg}/${bg} for accent=${accent} neutral=${neutral}`).toBeGreaterThanOrEqual(AA);
               }
            }
         }
      }
   });

   it('keeps surfaces neutral-ish even from a vivid neutral seed (clamped saturation)', () => {
      const set = deriveMode('hsl(0 0% 50%)', 'hsl(300 100% 50%)', 'light');
      expect(colorToHsl(set.background)[1]).toBeLessThanOrEqual(14);
   });

   it('makes dark-mode surfaces darker than light-mode, and flips the foreground', () => {
      const light = deriveMode('hsl(220 80% 50%)', 'hsl(220 30% 50%)', 'light');
      const dark = deriveMode('hsl(220 80% 50%)', 'hsl(220 30% 50%)', 'dark');
      expect(colorToHsl(dark.background)[2]).toBeLessThan(colorToHsl(light.background)[2]);
      expect(colorToHsl(light.foreground)[2]).toBeLessThan(50); // dark text on a light bg
      expect(colorToHsl(dark.foreground)[2]).toBeGreaterThan(50); // light text on a dark bg
   });

   it('always emits the safe red for destructive', () => {
      expect(deriveMode('hsl(120 90% 50%)', 'hsl(120 20% 50%)', 'light').destructive).toBe('hsl(0 72% 44%)');
      expect(deriveMode('hsl(120 90% 50%)', 'hsl(120 20% 50%)', 'dark').destructive).toBe('hsl(0 63% 47%)');
   });
});

describe('derive2Seed / derive4Seed', () => {
   it('2-seed produces a complete light + dark pair from one seed pair', () => {
      const { light, dark } = derive2Seed('hsl(280 70% 45%)', 'hsl(280 20% 50%)');
      for (const key of CHROME_TOKEN_KEYS) {
         expect(parseColorToRgb(light[key])).not.toBeNull();
         expect(parseColorToRgb(dark[key])).not.toBeNull();
      }
      // Same seeds, different modes -> different surfaces.
      expect(light.background).not.toBe(dark.background);
   });

   it('4-seed drives each mode from its own pair (modes are independent)', () => {
      const base = {
         lightAccent: 'hsl(10 80% 50%)', lightNeutral: 'hsl(10 20% 50%)',
         darkAccent: 'hsl(200 80% 55%)', darkNeutral: 'hsl(200 20% 50%)',
      };
      const result = derive4Seed(base);
      // Swapping ONLY the dark seeds leaves the light palette byte-identical and changes the dark one.
      const swapped = derive4Seed({ ...base, darkAccent: 'hsl(90 80% 55%)', darkNeutral: 'hsl(90 20% 50%)' });
      expect(swapped.light).toEqual(result.light);
      expect(swapped.dark).not.toEqual(result.dark);
   });
});
