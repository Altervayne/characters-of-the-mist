// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { deriveFromGenerator, deriveGeneratedMode, derivePaper, randomGeneratorSettings } from './deriveTheme';
import { CHROME_TOKEN_KEYS, CLASSIC_PAPER } from './themeTokens';
import { colorToHsl, contrastRatio, parseColorToRgb } from '@/lib/color';

// -- Type Imports --
import type { ContrastLevel, GeneratorTier, SaturationLevel, SeedSet, TokenSet } from './themeTokens';

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

   it('returns a complete, classic-rooted paper palette (header + accent re-hued)', () => {
      const tinted = derivePaper('hsl(310 80% 50%)', 'hsl(90 70% 50%)');
      expect(colorToHsl(tinted['paper-primary'])[0]).toBeCloseTo(310, -1);
      expect(colorToHsl(tinted['paper-accent'])[0]).toBeCloseTo(90, -1);
      expect(tinted['paper-background']).toBe(CLASSIC_PAPER['paper-background']);
   });
});

/* ===== The unified generator engine ===== */

const TIERS: GeneratorTier[] = [2, 3, 4];
const SATURATIONS: SaturationLevel[] = ['minimal', 'balanced', 'vivid'];
const CONTRASTS: ContrastLevel[] = ['soft', 'normal', 'contrasted'];

/** A full seed set (extra roles are ignored at lower tiers). A spread of hues + the achromatic / yellow corners. */
const GEN_SEEDS: SeedSet[] = [
   { primary: 'hsl(220 80% 50%)', background: 'hsl(220 30% 50%)', accent: 'hsl(40 90% 55%)', secondary: 'hsl(160 40% 50%)' },
   { primary: 'hsl(0 100% 50%)', background: 'hsl(0 60% 50%)', accent: 'hsl(120 100% 50%)', secondary: 'hsl(60 100% 50%)' },
   { primary: 'hsl(60 100% 50%)', background: 'hsl(60 80% 50%)', accent: 'hsl(300 80% 50%)', secondary: 'hsl(180 70% 50%)' }, // yellow corners
   { primary: 'hsl(0 0% 12%)', background: 'hsl(0 0% 60%)', accent: 'hsl(0 0% 50%)', secondary: 'hsl(0 0% 35%)' },             // achromatic
   { primary: 'hsl(280 70% 45%)', background: 'hsl(200 50% 50%)', accent: 'hsl(100 85% 60%)', secondary: 'hsl(20 70% 50%)' },
];

describe('deriveGeneratedMode', () => {
   const opts = { tier: 3 as GeneratorTier, saturation: 'balanced' as SaturationLevel, contrast: 'normal' as ContrastLevel };

   it('produces a complete, parseable TokenSet for every key, in both modes', () => {
      for (const mode of ['light', 'dark'] as const) {
         const set = deriveGeneratedMode(GEN_SEEDS[0], opts, mode);
         for (const key of CHROME_TOKEN_KEYS) {
            expect(typeof set[key]).toBe('string');
            expect(parseColorToRgb(set[key])).not.toBeNull();
         }
      }
   });

   it('saturation axis: vivid surfaces are more saturated than minimal', () => {
      const minimal = deriveGeneratedMode(GEN_SEEDS[0], { ...opts, saturation: 'minimal' }, 'light');
      const vivid = deriveGeneratedMode(GEN_SEEDS[0], { ...opts, saturation: 'vivid' }, 'light');
      expect(colorToHsl(vivid.background)[1]).toBeGreaterThan(colorToHsl(minimal.background)[1]);
   });

   it('contrast axis: contrasted has a wider surface spread than soft', () => {
      // Measure in dark mode, where surfaces rise from a low base without clamping at 100.
      const soft = deriveGeneratedMode(GEN_SEEDS[0], { ...opts, contrast: 'soft' }, 'dark');
      const contrasted = deriveGeneratedMode(GEN_SEEDS[0], { ...opts, contrast: 'contrasted' }, 'dark');
      const spread = (set: TokenSet) => Math.abs(colorToHsl(set.border)[2] - colorToHsl(set.background)[2]);
      expect(spread(contrasted)).toBeGreaterThan(spread(soft));
   });

   it('tier: 3 uses the accent seed hue; 2 derives the accent from the primary (so they differ)', () => {
      const seeds: SeedSet = { primary: 'hsl(0 80% 50%)', background: 'hsl(0 20% 50%)', accent: 'hsl(120 80% 50%)' };
      const tier3 = deriveGeneratedMode(seeds, { ...opts, tier: 3 }, 'light');
      const tier2 = deriveGeneratedMode(seeds, { ...opts, tier: 2 }, 'light');
      expect(colorToHsl(tier3.accent)[0]).toBeCloseTo(120, -1);          // the accent seed hue
      expect(colorToHsl(tier2.accent)[0]).not.toBeCloseTo(120, -1);      // derived from the primary instead
   });

   it('tier 4 colors the secondary from the secondary seed (not a neutral surface step)', () => {
      const seeds: SeedSet = { primary: 'hsl(0 80% 50%)', background: 'hsl(0 20% 50%)', accent: 'hsl(120 80% 50%)', secondary: 'hsl(280 70% 50%)' };
      const tier4 = deriveGeneratedMode(seeds, { ...opts, tier: 4 }, 'light');
      const tier3 = deriveGeneratedMode(seeds, { ...opts, tier: 3 }, 'light');
      expect(colorToHsl(tier4.secondary)[0]).toBeCloseTo(280, -1);       // the secondary seed hue
      expect(colorToHsl(tier3.secondary)[1]).toBeLessThan(colorToHsl(tier4.secondary)[1]); // tier 3 secondary is the quiet surface
   });

   // The guarantee: every tier x saturation x contrast combo, both modes, all seeds, clears AA on every required pair.
   it('clears the AA floor on every required pair across the whole tier x saturation x contrast matrix', () => {
      for (const seeds of GEN_SEEDS) {
         for (const tier of TIERS) {
            for (const saturation of SATURATIONS) {
               for (const contrast of CONTRASTS) {
                  for (const mode of ['light', 'dark'] as const) {
                     const set = deriveGeneratedMode(seeds, { tier, saturation, contrast }, mode);
                     for (const [fg, bg] of CONTRAST_PAIRS) {
                        const ratio = contrastRatio(set[fg], set[bg]);
                        expect(ratio, `${mode} t${tier}/${saturation}/${contrast} ${fg}/${bg} for ${JSON.stringify(seeds)}`).toBeGreaterThanOrEqual(AA);
                     }
                  }
               }
            }
         }
      }
   }, 30000);
});

describe('deriveFromGenerator', () => {
   const settings = { tier: 3 as GeneratorTier, separateModes: false, saturation: 'vivid' as SaturationLevel, contrast: 'contrasted' as ContrastLevel, seeds: GEN_SEEDS[0] };

   it('returns light + dark + paper', () => {
      const { light, dark, paper } = deriveFromGenerator(settings);
      for (const key of CHROME_TOKEN_KEYS) {
         expect(parseColorToRgb(light[key])).not.toBeNull();
         expect(parseColorToRgb(dark[key])).not.toBeNull();
      }
      expect(paper['paper-background']).toBeTruthy();
   });

   it('vivid + contrasted is bolder than minimal + soft (more surface saturation, wider spread)', () => {
      const bold = deriveFromGenerator(settings);
      const gentle = deriveFromGenerator({ ...settings, saturation: 'minimal', contrast: 'soft' });
      expect(colorToHsl(bold.light.background)[1]).toBeGreaterThan(colorToHsl(gentle.light.background)[1]);
      const spread = (set: TokenSet) => Math.abs(colorToHsl(set.border)[2] - colorToHsl(set.background)[2]);
      expect(spread(bold.dark)).toBeGreaterThan(spread(gentle.dark));
   });

   it('separateModes drives each mode from its own seed set', () => {
      const lightSeeds: SeedSet = { primary: 'hsl(30 80% 50%)', background: 'hsl(30 30% 50%)' };
      const darkSeeds: SeedSet = { primary: 'hsl(200 80% 50%)', background: 'hsl(200 30% 50%)' };
      const result = deriveFromGenerator({ tier: 2, separateModes: true, saturation: 'balanced', contrast: 'normal', seeds: { light: lightSeeds, dark: darkSeeds } });
      // The light primary follows the light seed hue (orange), the dark primary the dark seed hue (blue).
      expect(colorToHsl(result.light.primary)[0]).toBeCloseTo(30, -1);
      expect(colorToHsl(result.dark.primary)[0]).toBeCloseTo(200, -1);
   });
});

describe('randomGeneratorSettings', () => {
   it('keeps the caller tier / separateModes, fills the tier roles, and always passes required-pair AA', () => {
      for (let i = 0; i < 60; i++) {
         const tier = TIERS[i % 3];
         const separateModes = i % 2 === 0;
         const settings = randomGeneratorSettings({ tier, separateModes });
         expect(settings.tier).toBe(tier);
         expect(settings.separateModes).toBe(separateModes);
         expect(SATURATIONS).toContain(settings.saturation);
         expect(CONTRASTS).toContain(settings.contrast);

         const { light, dark } = deriveFromGenerator(settings);
         for (const mode of [light, dark]) {
            for (const [fg, bg] of CONTRAST_PAIRS) {
               expect(contrastRatio(mode[fg], mode[bg]), `random t${tier} sep=${separateModes} ${fg}/${bg} ${JSON.stringify(settings)}`).toBeGreaterThanOrEqual(AA);
            }
         }
      }
   });
});
