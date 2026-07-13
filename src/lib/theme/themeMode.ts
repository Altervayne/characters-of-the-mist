/*
 * Light/dark MODE resolution, split from the palette (`theme-*`) system. The mode owns only the `dark`/`light`
 * class on <html> (the palette class is owned by ThemeClassManager). Kept pure here so the resolution rules
 * are testable without a DOM; the DOM class writes and the `matchMedia` listener live in ThemeModeManager.
 */

/** The user's chosen mode. `system` follows the OS preference; the two others pin it. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** The mode actually applied to the document, after resolving `system` against the OS. */
export type ResolvedMode = 'light' | 'dark';

/** Resolve the chosen mode to a concrete light/dark, following the OS only when `system`. */
export function resolveThemeMode(mode: ThemeMode, systemPrefersDark: boolean): ResolvedMode {
   if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
   return mode;
}

/** The class to add and the one to remove for a resolved mode. `dark`/`light` are the only classes touched. */
export function themeModeClasses(resolvedMode: ResolvedMode): { add: ResolvedMode; remove: ResolvedMode } {
   return resolvedMode === 'dark' ? { add: 'dark', remove: 'light' } : { add: 'light', remove: 'dark' };
}
