// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { CONTRAST_PAIRS, lowContrastPairs } from './contrastWarnings';
import { derive2Seed } from './deriveTheme';
import { PRESET_THEMES } from './themeTokens';

// -- Type Imports --
import type { TokenSet } from './themeTokens';

/*
 * The warning predicate informs, never blocks: it should catch a foreground a user dragged too close to its
 * surface, while a properly derived theme (themes-2 guarantees AA) trips nothing.
 */

describe('lowContrastPairs', () => {
   it('flags a foreground set equal to its surface (ratio 1), naming the pair', () => {
      const set: TokenSet = { ...PRESET_THEMES['theme-neutral'].light, 'muted-foreground': PRESET_THEMES['theme-neutral'].light.muted };
      const warnings = lowContrastPairs(set);
      const muted = warnings.find((warning) => warning.foreground === 'muted-foreground');
      expect(muted).toBeDefined();
      expect(muted?.surface).toBe('muted');
      expect(muted?.ratio).toBeCloseTo(1, 1);
   });

   it('passes a derived theme (both modes clear the floor)', () => {
      const { light, dark } = derive2Seed('hsl(280 70% 45%)', 'hsl(280 20% 50%)');
      expect(lowContrastPairs(light)).toEqual([]);
      expect(lowContrastPairs(dark)).toEqual([]);
   });

   it('leaves a readable pair alone', () => {
      const set: TokenSet = { ...PRESET_THEMES['theme-neutral'].light };
      const warnings = lowContrastPairs(set);
      expect(warnings.find((warning) => warning.foreground === 'foreground')).toBeUndefined();
   });

   it('clears every foreground/surface pair on every built-in preset, both modes (no warning on duplicate)', () => {
      for (const [name, preset] of Object.entries(PRESET_THEMES)) {
         expect(lowContrastPairs(preset.light), `${name} light`).toEqual([]);
         expect(lowContrastPairs(preset.dark), `${name} dark`).toEqual([]);
      }
   });

   it('checks all eight foreground/surface pairs', () => {
      expect(CONTRAST_PAIRS).toHaveLength(8);
   });
});
