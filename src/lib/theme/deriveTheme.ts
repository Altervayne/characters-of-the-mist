// -- Utils Imports --
import { colorToHsl, contrastRatio, formatHsl } from '@/lib/color';

// -- Type Imports --
import type { TokenSet } from '@/lib/theme/themeTokens';

/*
 * The optional seed-to-theme generator: pure functions that turn an accent + neutral seed into a full
 * chrome TokenSet, per mode. The neutral seed tints the surfaces (its hue at a CLAMPED low saturation,
 * laid on a fixed per-mode lightness ramp), the accent seed colors primary / ring / the accent surface,
 * and foregrounds are AUTO-CONTRAST (pure black/white, whichever reads) so every required pair clears AA
 * regardless of the seeds. Destructive is a stable safe red. radius is NOT derived (manual, themes-3).
 */

/** Pure achromatic foreground candidates - the only pair that GUARANTEES AA against any surface. */
const FG_DARK = 'hsl(0 0% 0%)';
const FG_LIGHT = 'hsl(0 0% 100%)';

/** A vivid neutral seed still yields neutral-ish surfaces: cap the saturation it lends them. */
const SURFACE_SAT_CAP = 14;
/** The accent surface token keeps only a hint of the accent's saturation (a flavored hover, not the brand). */
const ACCENT_SURFACE_SAT_CAP = 30;

/** Per-mode lightness ramp for the neutral surfaces, lifted from the neutral preset and rounded. */
const SURFACE_LIGHTNESS = {
   light: { background: 96, card: 100, popover: 98, secondary: 96, muted: 96, accent: 96, border: 91, input: 91 },
   dark: { background: 6, card: 10, popover: 8, secondary: 18, muted: 18, accent: 18, border: 18, input: 18 },
} as const;

/** Keep primary a button-usable lightness per mode, so a too-light/too-dark accent still works. */
const PRIMARY_LIGHTNESS = { light: { min: 28, max: 52 }, dark: { min: 48, max: 70 } } as const;

/** The mid-contrast muted foreground lightness per mode. */
const MUTED_FOREGROUND_LIGHTNESS = { light: 40, dark: 62 } as const;

/** A stable, recognizable safe red per mode (dark enough that white text clears AA) + its near-white text. */
const DESTRUCTIVE = {
   light: 'hsl(0 72% 44%)',
   dark: 'hsl(0 63% 47%)',
} as const;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** The higher-contrast of pure black / white for a surface - guarantees a readable foreground on anything. */
function autoForeground(surface: string): string {
   return contrastRatio(surface, FG_DARK) >= contrastRatio(surface, FG_LIGHT) ? FG_DARK : FG_LIGHT;
}

/**
 * Derives one mode's full palette from an accent + neutral seed. Surfaces share the neutral hue at a capped
 * saturation over the per-mode ramp; primary/ring carry the accent (lightness clamped to a usable band);
 * the accent token is a faint accent-tinted surface; every foreground auto-contrasts; destructive is the
 * safe red. Any CSS color (hex or hsl) is accepted as a seed.
 */
export function deriveMode(accent: string, neutral: string, mode: 'light' | 'dark'): TokenSet {
   const [neutralHue, neutralSat] = colorToHsl(neutral);
   const [accentHue, accentSat, accentLightness] = colorToHsl(accent);

   const surfaceSat = Math.min(neutralSat, SURFACE_SAT_CAP);
   const ramp = SURFACE_LIGHTNESS[mode];
   const surface = (lightness: number) => formatHsl(neutralHue, surfaceSat, lightness);

   const background = surface(ramp.background);
   const card = surface(ramp.card);
   const popover = surface(ramp.popover);
   const secondary = surface(ramp.secondary);
   const muted = surface(ramp.muted);
   const border = surface(ramp.border);
   const input = surface(ramp.input);
   // A subtle accent-flavored hover surface (accent hue, faint saturation, on the surface ramp) - not the brand.
   const accentToken = formatHsl(accentHue, Math.min(accentSat, ACCENT_SURFACE_SAT_CAP), ramp.accent);

   const primary = formatHsl(accentHue, accentSat, clamp(accentLightness, PRIMARY_LIGHTNESS[mode].min, PRIMARY_LIGHTNESS[mode].max));
   const destructive = DESTRUCTIVE[mode];

   return {
      background, foreground: autoForeground(background),
      card, 'card-foreground': autoForeground(card),
      popover, 'popover-foreground': autoForeground(popover),
      primary, 'primary-foreground': autoForeground(primary),
      secondary, 'secondary-foreground': autoForeground(secondary),
      muted, 'muted-foreground': formatHsl(neutralHue, surfaceSat, MUTED_FOREGROUND_LIGHTNESS[mode]),
      accent: accentToken, 'accent-foreground': autoForeground(accentToken),
      destructive, 'destructive-foreground': autoForeground(destructive),
      border, input, ring: primary,
   };
}

/** 2-seed: one accent + neutral pair drives BOTH modes through the per-mode ramp. */
export function derive2Seed(accent: string, neutral: string): { light: TokenSet; dark: TokenSet } {
   return { light: deriveMode(accent, neutral, 'light'), dark: deriveMode(accent, neutral, 'dark') };
}

/** 4-seed: an independent accent + neutral pair per mode. */
export function derive4Seed(seeds: {
   lightAccent: string; lightNeutral: string; darkAccent: string; darkNeutral: string;
}): { light: TokenSet; dark: TokenSet } {
   return {
      light: deriveMode(seeds.lightAccent, seeds.lightNeutral, 'light'),
      dark: deriveMode(seeds.darkAccent, seeds.darkNeutral, 'dark'),
   };
}
