// -- Utils Imports --
import { colorToHsl, contrastRatio, formatHsl } from '@/lib/color';

// -- Theme Imports --
import { CLASSIC_PAPER } from '@/lib/theme/themeTokens';

// -- Type Imports --
import type { ContrastLevel, GeneratorSettings, GeneratorTier, PaperSet, SaturationLevel, SeedSet, TokenSet } from '@/lib/theme/themeTokens';

/*
 * The theme generator: pure functions that turn seed roles + the two modifier axes (saturation, contrast)
 * into a full chrome TokenSet per mode, plus a derived paper palette. Foregrounds are AUTO-CONTRAST (a tinted
 * near-b/w only when it clears AA, else pure black/white) so every required pair clears AA regardless of the
 * seeds; destructive is a stable safe red; radius is NOT derived (manual).
 */

/** Pure achromatic foreground candidates - the only pair that GUARANTEES AA against any surface. */
const FG_DARK = 'hsl(0 0% 0%)';
const FG_LIGHT = 'hsl(0 0% 100%)';

/** AA text floor; a tinted foreground is only used when it clears this, else pure black/white. */
const AA_FLOOR = 4.5;

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
 * Generated paper: the classic parchment with ONLY the header (primary) + accent re-hued from the seeds, so
 * it still reads as paper but matches the theme's character. Background / ink / border / secondary /
 * destructive stay classic. The primary foreground auto-contrasts the re-hued primary.
 */
export function derivePaper(primarySeed: string, accentSeed: string): PaperSet {
   const [primaryHue, primarySat] = colorToHsl(primarySeed);
   const [accentHue, accentSat] = colorToHsl(accentSeed);
   const primaryLightness = colorToHsl(CLASSIC_PAPER['paper-primary'])[2];
   const accentLightness = colorToHsl(CLASSIC_PAPER['paper-accent'])[2];
   const paperPrimary = formatHsl(primaryHue, primarySat, primaryLightness);
   return {
      ...CLASSIC_PAPER,
      'paper-primary': paperPrimary,
      'paper-primary-foreground': autoForeground(paperPrimary),
      'paper-accent': formatHsl(accentHue, accentSat, accentLightness),
   };
}

/* ============================================================================
 * One parameterized derivation: seed roles by tier, plus two modifier axes -
 * SATURATION (how tinted) and CONTRAST (how wide the lightness spread + how
 * visible the borders + how hard the foregrounds). Required-pair AA holds by
 * construction: a foreground is a hue-tinted near-b/w only when it clears AA,
 * else pure black/white, and the contrast axis only ever RAISES contrast
 * (surfaces never leave the safe edges).
 * ========================================================================== */

/** Surface hue saturation cap per saturation axis (minimal ~ the safe near-gray, vivid ~ the expressive tint). */
const GEN_SURFACE_SAT = { minimal: 8, balanced: 20, vivid: 36 } as const;
/** Accent / secondary saturation cap per saturation axis (near-neutral when minimal, bold when vivid). */
const GEN_ACCENT_SAT = { minimal: 14, balanced: 48, vivid: 82 } as const;
/** Foreground tint saturation per saturation axis (0 = pure black/white, like the safe path). */
const GEN_FG_TINT = { minimal: 0, balanced: 10, vivid: 22 } as const;

/** Background base lightness per mode, nudged toward the edge as contrast rises - kept far from the mid-tone
 *  danger zone, so the pure-b/w foreground always clears AA. */
const GEN_BG_BASE = {
   light: { soft: 95, normal: 96, contrasted: 98 },
   dark: { soft: 8, normal: 6, contrasted: 4 },
} as const;
/** The contrast axis scales the inter-surface spread + border distance (compress for soft, widen for contrasted). */
const GEN_SPREAD = { soft: 0.6, normal: 1, contrasted: 1.45 } as const;
/** Per-mode surface lightness offsets from the background base (the safe ramp), scaled by the contrast spread. */
const GEN_SURFACE_OFFSETS = {
   light: { card: 4, popover: 2, secondary: -3, muted: -2, border: -9, input: -9 },
   dark: { card: 4, popover: 2, secondary: 12, muted: 11, border: 15, input: 15 },
} as const;
/** The accent token's highlight-surface lightness band per mode. */
const GEN_ACCENT_LIGHTNESS = { light: { min: 60, max: 84 }, dark: { min: 38, max: 62 } } as const;
/** Tier 2 has no accent seed: derive the accent from the primary by this harmony angle (relates, not clashes). */
const GEN_ACCENT_HARMONY = 150;
/** Paper saturation cap + parchment hue-tint per saturation axis (minimal stays classic, vivid tints more). */
const GEN_PAPER_SAT_CAP = { minimal: 25, balanced: 45, vivid: 72 } as const;
const GEN_PAPER_BG_TINT = { minimal: 0, balanced: 0, vivid: 16 } as const;

/** The foreground for a surface: a hue-tinted near-b/w when it clears AA (and tinting isn't forced off), else
 *  pure black/white. `forcePureBW` is the contrasted axis (max contrast); `tintSat` is the saturation axis. */
function generatedForeground(surface: string, tintSat: number, forcePureBW: boolean): string {
   if (forcePureBW || tintSat <= 0) return autoForeground(surface);
   const [hue] = colorToHsl(surface);
   const wantDark = contrastRatio(surface, FG_DARK) >= contrastRatio(surface, FG_LIGHT);
   const tinted = formatHsl(hue, tintSat, wantDark ? 12 : 94);
   return contrastRatio(surface, tinted) >= AA_FLOOR ? tinted : autoForeground(surface);
}

/**
 * One mode's full palette from the seed roles + the two modifier axes. The BACKGROUND seed hues all the
 * surfaces (saturation by the sat axis, lightness on a per-mode ramp whose spread is the contrast axis); the
 * PRIMARY seed colors primary/ring (lightness clamped to a usable band); the ACCENT seed (tier>=3) is the real
 * accent token, else a harmony tint off the primary; the SECONDARY seed (tier 4) colors the secondary surface,
 * else it's a neutral step. Foregrounds clear AA by construction; destructive is the stable safe red.
 */
export function deriveGeneratedMode(
   seeds: SeedSet,
   opts: { tier: GeneratorTier; saturation: SaturationLevel; contrast: ContrastLevel },
   mode: 'light' | 'dark',
): TokenSet {
   const { tier, saturation, contrast } = opts;
   const [bgHue, bgSatRaw] = colorToHsl(seeds.background);
   const [primaryHue, primarySat, primaryL] = colorToHsl(seeds.primary);

   const surfaceSat = Math.min(bgSatRaw, GEN_SURFACE_SAT[saturation]);
   const base = GEN_BG_BASE[mode][contrast];
   const spread = GEN_SPREAD[contrast];
   const off = GEN_SURFACE_OFFSETS[mode];
   const surfaceAt = (offset: number) => formatHsl(bgHue, surfaceSat, clamp(base + offset * spread, 0, 100));

   const background = surfaceAt(0);
   const card = surfaceAt(off.card);
   const popover = surfaceAt(off.popover);
   const muted = surfaceAt(off.muted);
   const border = surfaceAt(off.border);
   const input = surfaceAt(off.input);

   const forcePureBW = contrast === 'contrasted';
   const tintSat = GEN_FG_TINT[saturation];
   const fg = (surface: string) => generatedForeground(surface, tintSat, forcePureBW);

   const primary = formatHsl(primaryHue, primarySat, clamp(primaryL, PRIMARY_LIGHTNESS[mode].min, PRIMARY_LIGHTNESS[mode].max));

   // Accent: the real accent seed (tier>=3) or a harmony tint off the primary; saturation by the sat axis.
   const accentHsl = tier >= 3 && seeds.accent ? colorToHsl(seeds.accent) : null;
   const accentHue = accentHsl ? accentHsl[0] : (primaryHue + GEN_ACCENT_HARMONY) % 360;
   const accentSat = Math.min(accentHsl ? accentHsl[1] : primarySat, GEN_ACCENT_SAT[saturation]);
   const accentBand = GEN_ACCENT_LIGHTNESS[mode];
   const accentL = accentHsl ? clamp(accentHsl[2], accentBand.min, accentBand.max) : (accentBand.min + accentBand.max) / 2;
   const accent = formatHsl(accentHue, accentSat, accentL);

   // Secondary: the secondary seed (tier 4) on the surface ramp, else a neutral surface step.
   const secondaryHsl = tier >= 4 && seeds.secondary ? colorToHsl(seeds.secondary) : null;
   const secondary = secondaryHsl
      ? formatHsl(secondaryHsl[0], Math.min(secondaryHsl[1], GEN_ACCENT_SAT[saturation]), clamp(base + off.secondary * spread, 0, 100))
      : surfaceAt(off.secondary);

   const destructive = DESTRUCTIVE[mode];

   return {
      background, foreground: fg(background),
      card, 'card-foreground': fg(card),
      popover, 'popover-foreground': fg(popover),
      primary, 'primary-foreground': fg(primary),
      secondary, 'secondary-foreground': fg(secondary),
      muted, 'muted-foreground': formatHsl(bgHue, surfaceSat, MUTED_FOREGROUND_LIGHTNESS[mode]),
      accent, 'accent-foreground': fg(accent),
      destructive, 'destructive-foreground': autoForeground(destructive),
      border, input, ring: primary,
   };
}

/** Generated paper: classic parchment, with the header (primary) + accent re-hued from the seeds and the
 *  saturation axis tilting how much tint they (and, when vivid, the parchment itself) carry. */
function deriveGeneratedPaper(primarySeed: string, accentSeed: string, saturation: SaturationLevel): PaperSet {
   const [primaryHue, primarySat] = colorToHsl(primarySeed);
   const [accentHue, accentSat] = colorToHsl(accentSeed);
   const cap = GEN_PAPER_SAT_CAP[saturation];
   const primaryL = colorToHsl(CLASSIC_PAPER['paper-primary'])[2];
   const accentL = colorToHsl(CLASSIC_PAPER['paper-accent'])[2];
   const bgTint = GEN_PAPER_BG_TINT[saturation];
   const classicBgL = colorToHsl(CLASSIC_PAPER['paper-background'])[2];
   const paperPrimary = formatHsl(primaryHue, Math.min(primarySat, cap), primaryL);
   return {
      ...CLASSIC_PAPER,
      'paper-background': bgTint > 0 ? formatHsl(primaryHue, bgTint, classicBgL) : CLASSIC_PAPER['paper-background'],
      'paper-primary': paperPrimary,
      'paper-primary-foreground': autoForeground(paperPrimary),
      'paper-accent': formatHsl(accentHue, Math.min(accentSat, cap), accentL),
   };
}

/** Runs the unified generator end to end: per-mode seeds -> both modes -> paper. The single seam the new
 *  generator UI's Generate will call. */
export function deriveFromGenerator(settings: GeneratorSettings): { light: TokenSet; dark: TokenSet; paper: PaperSet } {
   const { tier, separateModes, saturation, contrast, seeds } = settings;
   const lightSeeds = separateModes ? (seeds as { light: SeedSet; dark: SeedSet }).light : (seeds as SeedSet);
   const darkSeeds = separateModes ? (seeds as { light: SeedSet; dark: SeedSet }).dark : (seeds as SeedSet);
   const opts = { tier, saturation, contrast };
   const light = deriveGeneratedMode(lightSeeds, opts, 'light');
   const dark = deriveGeneratedMode(darkSeeds, opts, 'dark');
   const paperAccent = tier >= 3 && lightSeeds.accent ? lightSeeds.accent : lightSeeds.primary;
   const paper = deriveGeneratedPaper(lightSeeds.primary, paperAccent, saturation);
   return { light, dark, paper };
}

/* "Surprise me": roll a coherent, AA-safe set of seeds + modifier axes for the caller's tier / separateModes. */

const SATURATION_LEVELS: SaturationLevel[] = ['minimal', 'balanced', 'vivid'];
const CONTRAST_LEVELS: ContrastLevel[] = ['soft', 'normal', 'contrasted'];
/** Accent harmony angles off the primary (complement + split-complements + a triad) - relates, never clashes. */
const HARMONY_ANGLES = [150, 180, 210, 120];

const randIn = (min: number, max: number): number => min + Math.random() * (max - min);
const randPick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** A pleasant random seed set for the tier: a usable primary, a related surface hue, a harmony accent, a
 *  quiet secondary. Lightnesses sit in the bands the engine actually reads, so every roll is sensible. */
function randomSeedSet(tier: GeneratorTier): SeedSet {
   const primaryHue = Math.floor(randIn(0, 360));
   const set: SeedSet = {
      primary: formatHsl(primaryHue, randIn(55, 85), randIn(38, 56)),
      background: formatHsl((primaryHue + randIn(-25, 25) + 360) % 360, randIn(15, 40), 50),
   };
   if (tier >= 3) set.accent = formatHsl((primaryHue + randPick(HARMONY_ANGLES)) % 360, randIn(60, 88), randIn(48, 64));
   if (tier >= 4) set.secondary = formatHsl((primaryHue + randIn(-40, 40) + 360) % 360, randIn(20, 45), 50);
   return set;
}

/** "Surprise me": keep the caller's tier / separateModes, roll pleasant seeds + random modifier axes. */
export function randomGeneratorSettings(base: { tier: GeneratorTier; separateModes: boolean }): GeneratorSettings {
   return {
      tier: base.tier,
      separateModes: base.separateModes,
      saturation: randPick(SATURATION_LEVELS),
      contrast: randPick(CONTRAST_LEVELS),
      seeds: base.separateModes ? { light: randomSeedSet(base.tier), dark: randomSeedSet(base.tier) } : randomSeedSet(base.tier),
   };
}
