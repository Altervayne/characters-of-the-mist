// -- Library Imports --
import cuid from 'cuid';

// -- Store Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { customThemeClass } from '@/lib/theme/themeTokens';

// -- Type Imports --
import type { TokenSet } from '@/lib/theme/themeTokens';

/** The palettes a new custom is cloned from: a preset, or any existing theme. */
type ThemeSource = { light: TokenSet; dark: TokenSet; radius: string };

/**
 * Returns a function that clones the given palettes into a brand-new custom theme (deep-copied token sets,
 * fresh id) and selects it. Backs Duplicate, the "New Custom Theme" button, and the preset placeholder so
 * every "make me a theme" path runs through the same code.
 */
export function useCreateCustomTheme() {
   const { addCustomTheme, setTheme } = useAppSettingsActions();
   return (source: ThemeSource, name: string): string => {
      const id = cuid();
      addCustomTheme({ id, name, light: { ...source.light }, dark: { ...source.dark }, radius: source.radius });
      setTheme(customThemeClass(id));
      return id;
   };
}
