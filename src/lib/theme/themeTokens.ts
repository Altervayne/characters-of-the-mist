/*
 * The chrome-theme token registry: the single source of truth for which CSS variables a theme controls,
 * the four built-in presets' values (lifted from global.css so "duplicate a preset" works in JS), and the
 * helpers that turn a token set into the CSS a custom theme injects at runtime. The .card-type-* game
 * colors are NOT chrome and live only in global.css - never here.
 */

/** The 19 chrome color tokens every theme defines, in editor / injection / duplicate order. */
export const CHROME_TOKEN_KEYS = [
   'background', 'foreground',
   'card', 'card-foreground',
   'popover', 'popover-foreground',
   'primary', 'primary-foreground',
   'secondary', 'secondary-foreground',
   'muted', 'muted-foreground',
   'accent', 'accent-foreground',
   'destructive', 'destructive-foreground',
   'border', 'input', 'ring',
] as const;

export type ChromeTokenKey = (typeof CHROME_TOKEN_KEYS)[number];

/** A full chrome palette: one CSS color string per token. */
export type TokenSet = Record<ChromeTokenKey, string>;

/**
 * The editor's grouping of the 19 tokens: each surface paired with the foreground that sits on it, so the
 * two are edited side by side. Structure only - the section + token display labels are i18n
 * (`SettingsDialog.themes.groups.*` / `.tokens.*`), so the editor resolves them. (`ring` rides the primary
 * group; `border`/`input` have no foreground pair.)
 */
export const TOKEN_GROUPS: { id: string; tokens: ChromeTokenKey[] }[] = [
   { id: 'base', tokens: ['background', 'foreground'] },
   { id: 'card', tokens: ['card', 'card-foreground'] },
   { id: 'popover', tokens: ['popover', 'popover-foreground'] },
   { id: 'primary', tokens: ['primary', 'primary-foreground', 'ring'] },
   { id: 'secondary', tokens: ['secondary', 'secondary-foreground'] },
   { id: 'muted', tokens: ['muted', 'muted-foreground'] },
   { id: 'accent', tokens: ['accent', 'accent-foreground'] },
   { id: 'destructive', tokens: ['destructive', 'destructive-foreground'] },
   { id: 'lines', tokens: ['border', 'input'] },
];

/**
 * The seed-generator modes. 2-seed / 4-seed are the strictly-safe (near-gray) generators; 3-seed is the
 * Expressive mode - tinted surfaces, a real accent, seed-driven brightness - chosen deliberately.
 */
export type SeedMode = '2-seed' | '4-seed' | '3-seed';

/** 2-seed inputs: a single accent + neutral pair drives both light and dark. */
export interface TwoSeeds {
   accent: string;
   neutral: string;
}

/** 4-seed inputs: an independent accent + neutral pair per mode. */
export interface FourSeeds {
   lightAccent: string;
   lightNeutral: string;
   darkAccent: string;
   darkNeutral: string;
}

/** 3-seed (Expressive) inputs: a primary, a surface tint, and a real accent; `vivid` scales the boldness. */
export interface ThreeSeeds {
   primary: string;
   surface: string;
   accent: string;
   vivid?: boolean;
}

/** The seeds a theme was last generated from, kept so the panel restores them and can re-generate. */
export type ThemeSeeds = TwoSeeds | FourSeeds | ThreeSeeds;

/**
 * A user-defined theme. `light` / `dark` are the resolved palettes that actually apply (the source of
 * truth); `radius` is the shared corner size. When the theme was filled from the seed generator,
 * `seedMode` + `seeds` record what produced it (manual edits afterwards win - they overwrite tokens).
 */
export interface CustomTheme {
   id: string;
   name: string;
   light: TokenSet;
   dark: TokenSet;
   radius: string;
   seedMode?: SeedMode;
   seeds?: ThemeSeeds;
}

/** A custom theme's active value (and CSS class) is `theme-custom-{id}`, so the preset class-swap just works. */
export const CUSTOM_THEME_PREFIX = 'theme-custom-';

/** The active value for a custom theme by id (its value IS its class). */
export const customThemeClass = (id: string): `theme-custom-${string}` => `${CUSTOM_THEME_PREFIX}${id}`;

/** The id embedded in a `theme-custom-{id}` value, or null if this isn't a custom theme value. */
export const customThemeIdFromClass = (theme: string): string | null =>
   theme.startsWith(CUSTOM_THEME_PREFIX) ? theme.slice(CUSTOM_THEME_PREFIX.length) : null;

/** The id of the managed `<style>` element that holds the active custom theme's rules. */
export const CUSTOM_THEME_STYLE_ID = 'cotm-custom-theme';

/**
 * Serializes a token set to CSS custom-property declarations (`--background: <v>; ...`), appending
 * `--radius: <radius>;` when a radius is given (the light rule carries it; dark only overrides colors).
 */
export function tokenSetToCssVars(set: TokenSet, radius?: string): string {
   const declarations = CHROME_TOKEN_KEYS.map((key) => `--${key}: ${set[key]};`);
   if (radius !== undefined) declarations.push(`--radius: ${radius};`);
   return declarations.join(' ');
}

/** The built-in presets' display names (brand proper nouns, not translated), in selector order. */
export const PRESET_LABELS: Record<string, string> = {
   'theme-neutral': 'Neutral',
   'theme-legends': 'Legends in the Mist',
   'theme-otherscape': ':Otherscape',
   'theme-city-of-mist': 'City of Mist',
};

/** The built-in presets, keyed by their theme class - light/dark palettes + radius lifted from global.css. */
export const PRESET_THEMES: Record<string, { light: TokenSet; dark: TokenSet; radius: string }> = {
   'theme-neutral': {
      radius: '0.5rem',
      light: {
         background: 'hsl(0 0% 96%)', foreground: 'hsl(222.2 84% 4.9%)',
         card: 'hsl(0 0% 100%)', 'card-foreground': 'hsl(222.2 84% 4.9%)',
         popover: 'hsl(0 0% 98%)', 'popover-foreground': 'hsl(222.2 84% 4.9%)',
         primary: 'hsl(222.2 47.4% 11.2%)', 'primary-foreground': 'hsl(210 40% 98%)',
         secondary: 'hsl(210 40% 96.1%)', 'secondary-foreground': 'hsl(222.2 47.4% 11.2%)',
         muted: 'hsl(210 40% 96.1%)', 'muted-foreground': 'hsl(215.4 16.3% 44%)',
         accent: 'hsl(210 40% 96.1%)', 'accent-foreground': 'hsl(222.2 47.4% 11.2%)',
         destructive: 'hsl(0 72% 44%)', 'destructive-foreground': 'hsl(210 40% 98%)',
         border: 'hsl(214.3 31.8% 91.4%)', input: 'hsl(214.3 31.8% 91.4%)', ring: 'hsl(222.2 84% 4.9%)',
      },
      dark: {
         background: 'hsl(222.2 84% 5%)', foreground: 'hsl(210 40% 98%)',
         card: 'hsl(222.2 84% 10%)', 'card-foreground': 'hsl(210 40% 98%)',
         popover: 'hsl(222.2 84% 7.5%)', 'popover-foreground': 'hsl(210 40% 98%)',
         primary: 'hsl(210 40% 98%)', 'primary-foreground': 'hsl(222.2 47.4% 11.2%)',
         secondary: 'hsl(217.2 32.6% 17.5%)', 'secondary-foreground': 'hsl(210 40% 98%)',
         muted: 'hsl(217.2 32.6% 17.5%)', 'muted-foreground': 'hsl(215 20.2% 65.1%)',
         accent: 'hsl(217.2 32.6% 17.5%)', 'accent-foreground': 'hsl(210 40% 98%)',
         destructive: 'hsl(0 63% 47%)', 'destructive-foreground': 'hsl(210 40% 98%)',
         border: 'hsl(217.2 32.6% 17.5%)', input: 'hsl(217.2 32.6% 17.5%)', ring: 'hsl(212.7 26.8% 83.9%)',
      },
   },
   'theme-legends': {
      radius: '0.5rem',
      light: {
         background: 'hsl(210 6% 96%)', foreground: 'hsl(30 25% 10%)',
         card: 'hsl(43 40% 92%)', 'card-foreground': 'hsl(30 25% 10%)',
         popover: 'hsl(42 35% 85%)', 'popover-foreground': 'hsl(30 25% 10%)',
         primary: 'hsl(25 50% 20%)', 'primary-foreground': 'hsl(43 40% 98%)',
         secondary: 'hsl(210 8% 82%)', 'secondary-foreground': 'hsl(30 25% 10%)',
         muted: 'hsl(210 8% 82%)', 'muted-foreground': 'hsl(30 22% 32%)',
         accent: 'hsl(38 30% 76%)', 'accent-foreground': 'hsl(30 25% 10%)',
         destructive: 'hsl(0 72% 44%)', 'destructive-foreground': 'hsl(0 0% 98%)',
         border: 'hsl(25 30% 35%)', input: 'hsl(25 30% 35%)', ring: 'hsl(25 50% 20%)',
      },
      dark: {
         background: 'hsl(43 31% 5%)', foreground: 'hsl(43 30% 83%)',
         card: 'hsl(43 31% 15%)', 'card-foreground': 'hsl(43 30% 83%)',
         popover: 'hsl(43 31% 10%)', 'popover-foreground': 'hsl(43 30% 83%)',
         primary: 'hsl(43 30% 83%)', 'primary-foreground': 'hsl(43 31% 15%)',
         secondary: 'hsl(43 31% 25%)', 'secondary-foreground': 'hsl(43 30% 83%)',
         muted: 'hsl(43 31% 25%)', 'muted-foreground': 'hsl(43 16% 71%)',
         accent: 'hsl(43 31% 25%)', 'accent-foreground': 'hsl(43 30% 83%)',
         destructive: 'hsl(0 63% 47%)', 'destructive-foreground': 'hsl(0 0% 98%)',
         border: 'hsl(43 31% 25%)', input: 'hsl(43 31% 25%)', ring: 'hsl(43 30% 83%)',
      },
   },
   'theme-city-of-mist': {
      radius: '0.5rem',
      light: {
         background: 'hsl(240 10% 96%)', foreground: 'hsl(240 18% 10%)',
         card: 'hsl(240 15% 82%)', 'card-foreground': 'hsl(240 18% 10%)',
         popover: 'hsl(240 12% 88%)', 'popover-foreground': 'hsl(240 18% 10%)',
         primary: 'hsl(280 40% 42%)', 'primary-foreground': 'hsl(240 15% 96%)',
         secondary: 'hsl(240 12% 68%)', 'secondary-foreground': 'hsl(240 18% 10%)',
         muted: 'hsl(240 12% 68%)', 'muted-foreground': 'hsl(240 12% 25%)',
         accent: 'hsl(25 45% 72%)', 'accent-foreground': 'hsl(240 18% 10%)',
         destructive: 'hsl(0 72% 44%)', 'destructive-foreground': 'hsl(240 15% 96%)',
         border: 'hsl(240 12% 55%)', input: 'hsl(240 12% 55%)', ring: 'hsl(280 40% 42%)',
      },
      dark: {
         background: 'hsl(240 8% 12%)', foreground: 'hsl(240 5% 88%)',
         card: 'hsl(240 10% 16%)', 'card-foreground': 'hsl(240 5% 88%)',
         popover: 'hsl(240 10% 14%)', 'popover-foreground': 'hsl(240 5% 88%)',
         primary: 'hsl(280 25% 35%)', 'primary-foreground': 'hsl(240 5% 95%)',
         secondary: 'hsl(240 6% 22%)', 'secondary-foreground': 'hsl(240 5% 88%)',
         muted: 'hsl(240 6% 22%)', 'muted-foreground': 'hsl(240 5% 64%)',
         accent: 'hsl(25 45% 40%)', 'accent-foreground': 'hsl(240 5% 95%)',
         destructive: 'hsl(0 63% 47%)', 'destructive-foreground': 'hsl(240 5% 96%)',
         border: 'hsl(240 6% 28%)', input: 'hsl(240 6% 28%)', ring: 'hsl(280 50% 35%)',
      },
   },
   'theme-otherscape': {
      radius: '0.5rem',
      light: {
         background: 'hsl(210 5% 88%)', foreground: 'hsl(210 18% 12%)',
         card: 'hsl(210 6% 94%)', 'card-foreground': 'hsl(210 18% 12%)',
         popover: 'hsl(210 5% 91%)', 'popover-foreground': 'hsl(210 18% 12%)',
         primary: 'hsl(200 75% 38%)', 'primary-foreground': 'hsl(210 15% 98%)',
         secondary: 'hsl(210 10% 68%)', 'secondary-foreground': 'hsl(210 18% 12%)',
         muted: 'hsl(210 10% 68%)', 'muted-foreground': 'hsl(210 12% 25%)',
         accent: 'hsl(80 65% 72%)', 'accent-foreground': 'hsl(210 18% 12%)',
         destructive: 'hsl(0 72% 44%)', 'destructive-foreground': 'hsl(0 0% 98%)',
         border: 'hsl(210 15% 52%)', input: 'hsl(210 15% 52%)', ring: 'hsl(200 75% 38%)',
      },
      dark: {
         background: 'hsl(225 23% 8%)', foreground: 'hsl(190 67% 94%)',
         card: 'hsl(225 23% 8%)', 'card-foreground': 'hsl(190 67% 94%)',
         popover: 'hsl(225 23% 8%)', 'popover-foreground': 'hsl(190 67% 94%)',
         primary: 'hsl(76 100% 70%)', 'primary-foreground': 'hsl(225 23% 8%)',
         secondary: 'hsl(225 10% 20%)', 'secondary-foreground': 'hsl(190 67% 94%)',
         muted: 'hsl(225 10% 20%)', 'muted-foreground': 'hsl(190, 25%, 57%)',
         accent: 'hsl(190 70% 65%)', 'accent-foreground': 'hsl(225 23% 8%)',
         destructive: 'hsl(0 63% 47%)', 'destructive-foreground': 'hsl(0 0% 98%)',
         border: 'hsl(225 10% 20%)', input: 'hsl(225 10% 20%)', ring: 'hsl(76 100% 70%)',
      },
   },
};

/**
 * Resolves an active theme value to the class to put on `<html>` and the CSS for the managed style element.
 * A preset injects no CSS (its rules live in global.css). A custom theme injects its light + dark rules. A
 * custom value whose theme no longer exists (deleted / stale) falls back to a preset and reports it, so the
 * caller can correct the store and the app never ends up unstyled.
 */
export function resolveActiveTheme(
   theme: string,
   customThemes: CustomTheme[],
   fallback = 'theme-neutral',
): { className: string; css: string; isStale: boolean } {
   const id = customThemeIdFromClass(theme);
   if (id === null) return { className: theme, css: '', isStale: false };

   const custom = customThemes.find((entry) => entry.id === id);
   if (!custom) return { className: fallback, css: '', isStale: true };

   const css =
      `.${theme} { ${tokenSetToCssVars(custom.light, custom.radius)} }\n` +
      `.dark.${theme} { ${tokenSetToCssVars(custom.dark)} }`;
   return { className: theme, css, isStale: false };
}
