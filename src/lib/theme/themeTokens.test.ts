// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   CHROME_TOKEN_KEYS,
   PRESET_THEMES,
   customThemeClass,
   customThemeIdFromClass,
   resolveActiveTheme,
   tokenSetToCssVars,
} from './themeTokens';

// -- Type Imports --
import type { CustomTheme, TokenSet } from './themeTokens';

/*
 * Tests for the pure theme-token helpers: serialization, the custom-id round-trip, and the active-theme
 * resolution (preset = no CSS, custom = injected rules, stale custom = preset fallback).
 */

const sampleSet = PRESET_THEMES['theme-neutral'].light;

describe('tokenSetToCssVars', () => {
   it('emits one declaration per chrome token', () => {
      const css = tokenSetToCssVars(sampleSet);
      for (const key of CHROME_TOKEN_KEYS) {
         expect(css).toContain(`--${key}: ${sampleSet[key]};`);
      }
      expect(css).not.toContain('--radius'); // no radius unless asked
   });

   it('appends --radius when given', () => {
      expect(tokenSetToCssVars(sampleSet, '0.75rem')).toContain('--radius: 0.75rem;');
   });
});

describe('custom-theme class helpers', () => {
   it('round-trips a custom id through its class', () => {
      expect(customThemeClass('abc')).toBe('theme-custom-abc');
      expect(customThemeIdFromClass('theme-custom-abc')).toBe('abc');
   });

   it('returns null for a preset class', () => {
      expect(customThemeIdFromClass('theme-neutral')).toBeNull();
   });
});

describe('PRESET_THEMES', () => {
   it('holds the four presets, each a full light + dark token set + radius', () => {
      const names = Object.keys(PRESET_THEMES);
      expect(names).toEqual(['theme-neutral', 'theme-legends', 'theme-city-of-mist', 'theme-otherscape']);
      for (const preset of Object.values(PRESET_THEMES)) {
         expect(preset.radius).toBeTruthy();
         for (const key of CHROME_TOKEN_KEYS) {
            expect(typeof preset.light[key]).toBe('string');
            expect(typeof preset.dark[key]).toBe('string');
         }
      }
   });

   it('restores the otherscape dark ring to a wrapped hsl() value', () => {
      expect(PRESET_THEMES['theme-otherscape'].dark.ring).toBe('hsl(76 100% 70%)');
   });
});

describe('resolveActiveTheme', () => {
   const custom: CustomTheme = {
      id: 'x1', name: 'Mine', radius: '0.25rem',
      light: { ...sampleSet, background: 'hotpink' } as TokenSet,
      dark: { ...PRESET_THEMES['theme-neutral'].dark, background: 'rebeccapurple' } as TokenSet,
   };

   it('returns a preset class with no CSS for a preset', () => {
      const r = resolveActiveTheme('theme-legends', [custom]);
      expect(r).toEqual({ className: 'theme-legends', css: '', isStale: false });
   });

   it('builds light + dark rules for an active custom theme (radius on the light rule only)', () => {
      const r = resolveActiveTheme('theme-custom-x1', [custom]);
      expect(r.isStale).toBe(false);
      expect(r.className).toBe('theme-custom-x1');
      expect(r.css).toContain('.theme-custom-x1 { ');
      expect(r.css).toContain('--background: hotpink;');
      expect(r.css).toContain('--radius: 0.25rem;');
      expect(r.css).toContain('.dark.theme-custom-x1 { ');
      expect(r.css).toContain('--background: rebeccapurple;');
      // The dark rule carries colors only - radius lives on the light rule.
      expect(r.css.split('.dark.theme-custom-x1')[1]).not.toContain('--radius');
   });

   it('falls back to a preset (and flags stale) for a missing custom id', () => {
      const r = resolveActiveTheme('theme-custom-gone', [custom]);
      expect(r).toEqual({ className: 'theme-neutral', css: '', isStale: true });
   });
});
