// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { resolveThemeMode, themeModeClasses } from './themeMode';

/*
 * The pure light/dark mode resolution: pinned modes ignore the OS, `system` follows it, and the
 * class mapping only ever swaps `dark`/`light`. The `matchMedia` subscription + DOM writes live in
 * ThemeModeManager (browser-only) and are the owner's cursor to confirm.
 */

describe('resolveThemeMode', () => {
   it('pins to the chosen mode regardless of the OS preference', () => {
      expect(resolveThemeMode('light', true)).toBe('light');
      expect(resolveThemeMode('light', false)).toBe('light');
      expect(resolveThemeMode('dark', true)).toBe('dark');
      expect(resolveThemeMode('dark', false)).toBe('dark');
   });

   it('follows the OS preference when the mode is system', () => {
      expect(resolveThemeMode('system', true)).toBe('dark');
      expect(resolveThemeMode('system', false)).toBe('light');
   });
});

describe('themeModeClasses', () => {
   it('adds the resolved mode class and removes its opposite', () => {
      expect(themeModeClasses('dark')).toEqual({ add: 'dark', remove: 'light' });
      expect(themeModeClasses('light')).toEqual({ add: 'light', remove: 'dark' });
   });
});
