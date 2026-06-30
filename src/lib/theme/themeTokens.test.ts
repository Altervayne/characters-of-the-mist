// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   CHROME_TOKEN_KEYS,
   CLASSIC_PAPER,
   PAPER_TOKEN_KEYS,
   PRESET_THEMES,
   customThemeClass,
   customThemeIdFromClass,
   paperSetToCssVars,
   resolveActiveTheme,
   themeEditorFieldsEqual,
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

describe('paperSetToCssVars', () => {
   it('emits one --paper-* declaration per paper token', () => {
      const css = paperSetToCssVars(CLASSIC_PAPER);
      for (const key of PAPER_TOKEN_KEYS) {
         expect(css).toContain(`--${key}: ${CLASSIC_PAPER[key]};`);
      }
   });
});

describe('PRESET_THEMES paper', () => {
   it('gives every preset the classic paper', () => {
      for (const preset of Object.values(PRESET_THEMES)) {
         expect(preset.paper).toBe(CLASSIC_PAPER);
      }
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
      paper: CLASSIC_PAPER,
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

   it('emits paper on the BASE rule only (mode-agnostic), never the .dark rule', () => {
      const r = resolveActiveTheme('theme-custom-x1', [custom]);
      expect(r.css).toContain(`--paper-background: ${CLASSIC_PAPER['paper-background']};`);
      // Paper rides the base rule, never the .dark rule.
      expect(r.css.split('.dark.theme-custom-x1')[1]).not.toContain('--paper-');
   });

   it('emits a custom theme\'s own paper when it has one', () => {
      const withPaper: CustomTheme = { ...custom, paper: { ...CLASSIC_PAPER, 'paper-background': 'seagreen' } };
      const r = resolveActiveTheme('theme-custom-x1', [withPaper]);
      expect(r.css).toContain('--paper-background: seagreen;');
      expect(r.css).not.toContain(`--paper-background: ${CLASSIC_PAPER['paper-background']};`);
   });

   it('falls back to a preset (and flags stale) for a missing custom id', () => {
      const r = resolveActiveTheme('theme-custom-gone', [custom]);
      expect(r).toEqual({ className: 'theme-neutral', css: '', isStale: true });
   });

   it('prefers a draft for the matching active theme (live preview of unsaved edits)', () => {
      const draft: CustomTheme = { ...custom, light: { ...custom.light, background: 'lime' } as TokenSet };
      const r = resolveActiveTheme('theme-custom-x1', [custom], 'theme-neutral', draft);
      expect(r.css).toContain('--background: lime;'); // the draft's value, not the saved 'hotpink'
      expect(r.css).not.toContain('--background: hotpink;');
   });

   it('ignores a draft whose id does not match the active theme', () => {
      const otherDraft: CustomTheme = { ...custom, id: 'other', light: { ...custom.light, background: 'lime' } as TokenSet };
      const r = resolveActiveTheme('theme-custom-x1', [custom], 'theme-neutral', otherDraft);
      expect(r.css).toContain('--background: hotpink;'); // the saved value, draft is for another theme
   });

   it('builds identical CSS with no draft (no-draft path unchanged)', () => {
      expect(resolveActiveTheme('theme-custom-x1', [custom], 'theme-neutral', null))
         .toEqual(resolveActiveTheme('theme-custom-x1', [custom]));
   });
});

describe('themeEditorFieldsEqual', () => {
   const base: CustomTheme = {
      id: 'a', name: 'A', radius: '0.5rem',
      light: { ...sampleSet } as TokenSet, dark: { ...PRESET_THEMES['theme-neutral'].dark } as TokenSet,
      paper: CLASSIC_PAPER,
      generator: { tier: 3, separateModes: false, saturation: 'balanced', contrast: 'normal', seeds: { primary: '#111', background: '#222' } },
   };

   it('is true for clones, and ignores name/id differences', () => {
      expect(themeEditorFieldsEqual(base, { ...base, id: 'b', name: 'Renamed' })).toBe(true);
   });

   it('is false when an editor field differs (light, radius, paper, or generator)', () => {
      expect(themeEditorFieldsEqual(base, { ...base, radius: '1rem' })).toBe(false);
      expect(themeEditorFieldsEqual(base, { ...base, light: { ...base.light, background: 'lime' } as TokenSet })).toBe(false);
      expect(themeEditorFieldsEqual(base, { ...base, generator: { ...base.generator!, saturation: 'vivid' } })).toBe(false);
      expect(themeEditorFieldsEqual(base, { ...base, paper: { ...CLASSIC_PAPER, 'paper-primary': 'lime' } })).toBe(false);
   });
});
