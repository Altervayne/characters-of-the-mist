// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { derive2Seed, derive3Seed, derive4Seed, deriveExpressiveMode, deriveFromSeeds, deriveMode, derivePaper } from './deriveTheme';
import { CHROME_TOKEN_KEYS, CLASSIC_PAPER } from './themeTokens';
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

   // Heavy: ~28.8k palettes; given a wide timeout so it never flakes under parallel suite load.
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
   }, 30000);

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

describe('deriveFromSeeds', () => {
   it('routes 2-seed to derive2Seed', () => {
      const seeds = { accent: '#2563eb', neutral: '#6b7280' };
      expect(deriveFromSeeds('2-seed', seeds)).toEqual(derive2Seed(seeds.accent, seeds.neutral));
   });

   it('routes 4-seed to derive4Seed', () => {
      const seeds = { lightAccent: '#10b981', lightNeutral: '#9ca3af', darkAccent: '#f59e0b', darkNeutral: '#52525b' };
      expect(deriveFromSeeds('4-seed', seeds)).toEqual(derive4Seed(seeds));
   });

   it('routes 3-seed to derive3Seed', () => {
      const seeds = { primary: '#2563eb', surface: '#6b7280', accent: '#f59e0b', vivid: true };
      expect(deriveFromSeeds('3-seed', seeds)).toEqual(derive3Seed(seeds));
   });
});

/** A coarse seed grid for the 3-dimensional Expressive AA sweep (full grid cubed would be enormous). */
function coarseSeeds(): string[] {
   const seeds = [0, 60, 120, 180, 240, 300].map((hue) => `hsl(${hue} 80% 50%)`);
   seeds.push('hsl(0 0% 10%)', 'hsl(0 0% 90%)', 'hsl(210 100% 50%)', 'hsl(40 100% 60%)', 'hsl(0 0% 50%)');
   return seeds;
}
const COARSE = coarseSeeds();

describe('deriveExpressiveMode / derive3Seed (Expressive)', () => {
   it('produces a complete, parseable TokenSet in both modes and both vivid states', () => {
      for (const mode of ['light', 'dark'] as const) {
         for (const vivid of [false, true]) {
            const set = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 60% 50%)', 'hsl(45 90% 55%)', mode, vivid);
            for (const key of CHROME_TOKEN_KEYS) {
               expect(typeof set[key]).toBe('string');
               expect(parseColorToRgb(set[key])).not.toBeNull();
            }
         }
      }
   });

   // The whole point: surfaces and accent are tinted/real, NOT the safe near-gray output.
   it('makes surfaces more saturated than the safe mode (a real tint, not near-gray)', () => {
      const expr = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 80% 50%)', 'hsl(45 90% 55%)', 'light', false);
      expect(colorToHsl(expr.background)[1]).toBeGreaterThan(14); // above the safe SURFACE_SAT_CAP
   });

   it('gives accent a real saturation, unlike the safe faint-tint accent', () => {
      const expr = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 60% 50%)', 'hsl(45 95% 55%)', 'light', true);
      expect(colorToHsl(expr.accent)[1]).toBeGreaterThan(30); // above the safe ACCENT_SURFACE_SAT_CAP
   });

   it('vivid is bolder: surfaces carry more saturation than calm for a saturated surface seed', () => {
      const calm = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 100% 50%)', 'hsl(45 90% 55%)', 'light', false);
      const vivid = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 100% 50%)', 'hsl(45 90% 55%)', 'light', true);
      expect(colorToHsl(vivid.background)[1]).toBeGreaterThan(colorToHsl(calm.background)[1]);
   });

   it('drives surface brightness from the surface seed (a darker light-mode seed yields a dimmer background)', () => {
      const bright = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 60% 95%)', 'hsl(45 90% 55%)', 'light', false);
      const dim = deriveExpressiveMode('hsl(220 80% 50%)', 'hsl(30 60% 50%)', 'hsl(45 90% 55%)', 'light', false);
      expect(colorToHsl(bright.background)[2]).toBeGreaterThan(colorToHsl(dim.background)[2]);
   });

   // Bold but still readable: every REQUIRED pair clears AA across the seed cube, both modes, both vivid.
   it('clears the AA floor on every required pair across the Expressive seed cube (both modes, both vivid)', () => {
      for (const primary of COARSE) {
         for (const surface of COARSE) {
            for (const accent of COARSE) {
               for (const mode of ['light', 'dark'] as const) {
                  for (const vivid of [false, true]) {
                     const set = deriveExpressiveMode(primary, surface, accent, mode, vivid);
                     for (const [fg, bg] of CONTRAST_PAIRS) {
                        const ratio = contrastRatio(set[fg], set[bg]);
                        expect(ratio, `${mode} vivid=${vivid} ${fg}/${bg} p=${primary} s=${surface} a=${accent}`).toBeGreaterThanOrEqual(AA);
                     }
                  }
               }
            }
         }
      }
   }, 30000);

   it('3-seed drives both modes from one shared seed set + vivid flag', () => {
      const { light, dark } = derive3Seed({ primary: 'hsl(220 80% 50%)', surface: 'hsl(30 60% 50%)', accent: 'hsl(45 90% 55%)', vivid: true });
      expect(light.background).not.toBe(dark.background);
   });
});

describe('derivePaper', () => {
   const paper = derivePaper('hsl(200 80% 50%)', 'hsl(120 70% 50%)');

   it('keeps the classic parchment for everything but the header (primary) + accent', () => {
      for (const key of ['paper-background', 'paper-foreground', 'paper-border', 'paper-secondary', 'paper-secondary-foreground', 'paper-destructive', 'paper-destructive-foreground'] as const) {
         expect(paper[key]).toBe(CLASSIC_PAPER[key]);
      }
   });

   it('re-hues paper-primary from the primary seed and paper-accent from the accent seed (at the classic lightness)', () => {
      expect(colorToHsl(paper['paper-primary'])[0]).toBeCloseTo(200, -1);
      expect(colorToHsl(paper['paper-accent'])[0]).toBeCloseTo(120, -1);
      expect(colorToHsl(paper['paper-primary'])[2]).toBeCloseTo(colorToHsl(CLASSIC_PAPER['paper-primary'])[2], -1);
      expect(colorToHsl(paper['paper-accent'])[2]).toBeCloseTo(colorToHsl(CLASSIC_PAPER['paper-accent'])[2], -1);
   });

   it('auto-contrasts paper-primary-foreground against the re-hued header (pure black/white, clears AA)', () => {
      expect(['hsl(0 0% 0%)', 'hsl(0 0% 100%)']).toContain(paper['paper-primary-foreground']);
      expect(contrastRatio(paper['paper-primary-foreground'], paper['paper-primary'])).toBeGreaterThanOrEqual(AA);
   });

   it('each generator returns paper (classic base, header/accent from the seeds)', () => {
      expect(derive2Seed('hsl(200 80% 50%)', 'hsl(0 0% 50%)').paper).toEqual(derivePaper('hsl(200 80% 50%)', 'hsl(200 80% 50%)'));
      expect(derive3Seed({ primary: 'hsl(200 80% 50%)', surface: 'hsl(30 50% 50%)', accent: 'hsl(120 70% 50%)' }).paper).toEqual(derivePaper('hsl(200 80% 50%)', 'hsl(120 70% 50%)'));
      expect(derive4Seed({ lightAccent: 'hsl(200 80% 50%)', lightNeutral: 'hsl(0 0% 50%)', darkAccent: 'hsl(50 80% 50%)', darkNeutral: 'hsl(0 0% 50%)' }).paper).toEqual(derivePaper('hsl(200 80% 50%)', 'hsl(200 80% 50%)'));
   });
});
