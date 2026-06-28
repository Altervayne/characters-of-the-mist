// -- Utils Imports --
import { colorToHsl, contrastRatio, formatHsl } from '@/lib/color';

// -- Type Imports --
import type { FourSeeds, SeedMode, ThemeSeeds, ThreeSeeds, TokenSet, TwoSeeds } from '@/lib/theme/themeTokens';

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
export function derive4Seed(seeds: FourSeeds): { light: TokenSet; dark: TokenSet } {
   return {
      light: deriveMode(seeds.lightAccent, seeds.lightNeutral, 'light'),
      dark: deriveMode(seeds.darkAccent, seeds.darkNeutral, 'dark'),
   };
}

/*
 * Expressive (3-seed) mode brings back the levers the safe modes clamp away - so themes look characterful,
 * not near-gray - WITHOUT giving up the required-pair AA guarantee:
 *   - surfaces carry the SURFACE seed's hue at a higher saturation, on a base lightness driven by that
 *     seed (so themes differ in brightness/mood, not just hue), with the safe ramp applied as offsets;
 *   - foregrounds are TINTED near-black/white in their surface's hue, used only when they clear AA, else
 *     pure black/white - so every required pair is still readable by construction;
 *   - primary comes from the PRIMARY seed; accent is a REAL second color from the ACCENT seed (the pop
 *     the presets have), not a faint tint;
 *   - destructive stays the stable safe red.
 * `vivid` scales the three boldness levers (surface saturation, foreground tint, accent saturation).
 */

/** AA text floor; a tinted foreground is only used when it clears this, else pure black/white. */
const AA_FLOOR = 4.5;

/** Surface saturation caps - far above the safe 14, scaled by `vivid`. */
const EXPRESSIVE_SURFACE_SAT = { calm: 26, vivid: 40 } as const;
/** Foreground tint saturation (the warmth/coolness of the near-black/white text), scaled by `vivid`. */
const FG_TINT_SAT = { calm: 12, vivid: 24 } as const;
/** The surface set's base lightness band per mode; the surface seed picks a point in it. */
const SURFACE_BASE_LIGHTNESS = { light: { min: 90, max: 99 }, dark: { min: 4, max: 14 } } as const;
/** The safe ramp re-expressed as offsets from `background`, so the whole set shifts with the base. */
const SURFACE_OFFSETS = {
   light: { background: 0, card: 4, popover: 2, secondary: 0, muted: 0, border: -5, input: -5 },
   dark: { background: 0, card: 4, popover: 2, secondary: 12, muted: 12, border: 12, input: 12 },
} as const;
/** The accent token's lightness band per mode (a usable highlight surface) + its calm saturation cap. */
const ACCENT_LIGHTNESS = { light: { min: 62, max: 82 }, dark: { min: 40, max: 60 } } as const;
const ACCENT_SAT_CALM_CAP = 65;

/** A tinted near-black/white in the surface's own hue, used only if it clears AA - else pure black/white. */
function expressiveForeground(surface: string, tintSat: number): string {
   const [hue] = colorToHsl(surface);
   const wantDark = contrastRatio(surface, FG_DARK) >= contrastRatio(surface, FG_LIGHT);
   const tinted = formatHsl(hue, tintSat, wantDark ? 12 : 94);
   return contrastRatio(surface, tinted) >= AA_FLOOR ? tinted : autoForeground(surface);
}

/** One mode of the Expressive palette: tinted surfaces + AA-verified tinted foregrounds + a real accent. */
export function deriveExpressiveMode(primary: string, surface: string, accent: string, mode: 'light' | 'dark', vivid: boolean): TokenSet {
   const [surfaceHue, surfaceSatRaw, surfaceL] = colorToHsl(surface);
   const [primaryHue, primarySat, primaryL] = colorToHsl(primary);
   const [accentHue, accentSatRaw, accentL] = colorToHsl(accent);

   const surfaceSat = Math.min(surfaceSatRaw, vivid ? EXPRESSIVE_SURFACE_SAT.vivid : EXPRESSIVE_SURFACE_SAT.calm);
   const band = SURFACE_BASE_LIGHTNESS[mode];
   const base = clamp(surfaceL, band.min, band.max);
   const offsets = SURFACE_OFFSETS[mode];
   const surfaceAt = (offset: number) => formatHsl(surfaceHue, surfaceSat, clamp(base + offset, 0, 100));

   const background = surfaceAt(offsets.background);
   const card = surfaceAt(offsets.card);
   const popover = surfaceAt(offsets.popover);
   const secondary = surfaceAt(offsets.secondary);
   const muted = surfaceAt(offsets.muted);
   const border = surfaceAt(offsets.border);
   const input = surfaceAt(offsets.input);

   const tintSat = vivid ? FG_TINT_SAT.vivid : FG_TINT_SAT.calm;
   const fg = (s: string) => expressiveForeground(s, tintSat);

   const primaryColor = formatHsl(primaryHue, primarySat, clamp(primaryL, PRIMARY_LIGHTNESS[mode].min, PRIMARY_LIGHTNESS[mode].max));

   const accentSat = vivid ? accentSatRaw : Math.min(accentSatRaw, ACCENT_SAT_CALM_CAP);
   const accentColor = formatHsl(accentHue, accentSat, clamp(accentL, ACCENT_LIGHTNESS[mode].min, ACCENT_LIGHTNESS[mode].max));

   const destructive = DESTRUCTIVE[mode];

   return {
      background, foreground: fg(background),
      card, 'card-foreground': fg(card),
      popover, 'popover-foreground': fg(popover),
      primary: primaryColor, 'primary-foreground': fg(primaryColor),
      secondary, 'secondary-foreground': fg(secondary),
      // Muted text stays a mid-tone secondary tone (like the safe mode), tinted to the surface hue.
      muted, 'muted-foreground': formatHsl(surfaceHue, surfaceSat, MUTED_FOREGROUND_LIGHTNESS[mode]),
      accent: accentColor, 'accent-foreground': fg(accentColor),
      destructive, 'destructive-foreground': autoForeground(destructive),
      border, input, ring: primaryColor,
   };
}

/** 3-seed (Expressive): one primary/surface/accent set + the vivid flag drive BOTH modes. */
export function derive3Seed(seeds: ThreeSeeds): { light: TokenSet; dark: TokenSet } {
   const vivid = seeds.vivid ?? false;
   return {
      light: deriveExpressiveMode(seeds.primary, seeds.surface, seeds.accent, 'light', vivid),
      dark: deriveExpressiveMode(seeds.primary, seeds.surface, seeds.accent, 'dark', vivid),
   };
}

/** Routes a seed set through the matching generator - the single seam the editor's Generate calls. */
export function deriveFromSeeds(mode: SeedMode, seeds: ThemeSeeds): { light: TokenSet; dark: TokenSet } {
   if (mode === '2-seed') return derive2Seed((seeds as TwoSeeds).accent, (seeds as TwoSeeds).neutral);
   if (mode === '3-seed') return derive3Seed(seeds as ThreeSeeds);
   return derive4Seed(seeds as FourSeeds);
}
