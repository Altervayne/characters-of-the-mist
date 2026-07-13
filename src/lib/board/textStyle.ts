// -- Type Imports --
import type { CSSProperties } from 'react';
import type { TextFontFamily, TextStyle } from '@/lib/types/board';

/*
 * Pure typography helpers for the bare board TEXT element. `sans`/`serif`/`mono` resolve to generic CSS
 * stacks (no bundled file, no precache cost); the display tokens resolve to self-hosted woff2 faces
 * declared in `global.css`, each with a generic fallback so an unloaded face still renders. Kept free of
 * React/store so the mapping and the size stepper are unit-testable.
 */

/**
 * The CSS stacks the {@link TextFontFamily} tokens resolve to. `sans` mirrors the app body. The display
 * tokens name a self-hosted face first (see the `@font-face` block in `global.css`) then fall back to a
 * generic family, so the text stays readable even before the face loads (or if its file is missing).
 */
export const TEXT_FONT_STACKS: Record<TextFontFamily, string> = {
   sans: "'Inter', ui-sans-serif, system-ui, sans-serif",
   serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
   mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
   handwriting: "'Caveat', ui-rounded, 'Segoe Print', cursive",
   marker: "'Permanent Marker', 'Comic Sans MS', cursive",
   rounded: "'Fredoka', ui-rounded, 'Segoe UI', sans-serif",
};

/** A short specimen label for each token, rendered in its own face in the font picker. */
export const TEXT_FONT_LABELS: Record<TextFontFamily, string> = {
   sans: 'Sans',
   serif: 'Serif',
   mono: 'Mono',
   handwriting: 'Handwriting',
   marker: 'Marker',
   rounded: 'Rounded',
};

/** The font tokens in the order the picker lists them: the generic stacks first, then the display faces. */
export const TEXT_FONT_FAMILIES: TextFontFamily[] = ['sans', 'serif', 'mono', 'handwriting', 'marker', 'rounded'];

/** The size ladder (world px) the stepper walks between {@link MIN_TEXT_SIZE} and {@link MAX_TEXT_SIZE}. */
export const TEXT_SIZE_PRESETS = [12, 14, 16, 20, 24, 32, 48, 64, 96] as const;

/** A fresh text element's size. */
export const DEFAULT_TEXT_SIZE = 24;
/** Size clamp bounds (world px). */
export const MIN_TEXT_SIZE = 8;
export const MAX_TEXT_SIZE = 240;

/** A fresh text element's style: adaptive color, sans, default size, no emphasis, left-aligned. */
export function defaultTextStyle(): TextStyle {
   return { color: null, fontFamily: 'sans', size: DEFAULT_TEXT_SIZE, weight: 'normal', italic: false, underline: false, align: 'left' };
}

/**
 * Maps a {@link TextStyle} to the CSS that renders it. `color: null` resolves to the theme foreground
 * token (the adaptive default that stays readable on any board theme - `currentColor` on the canvas can
 * resolve to something at/near the background); a set hex is used verbatim (ink/text is the one sanctioned
 * raw-hex place). Shared by the resting text, the edit textarea, and the sizer so all three stay aligned.
 */
export function textStyleToCss(style: TextStyle): CSSProperties {
   return {
      color: style.color ?? 'var(--foreground)',
      fontFamily: TEXT_FONT_STACKS[style.fontFamily],
      fontSize: style.size,
      fontWeight: style.weight === 'bold' ? 700 : 400,
      fontStyle: style.italic ? 'italic' : 'normal',
      textDecoration: style.underline ? 'underline' : 'none',
      textAlign: style.align,
      lineHeight: 1.25,
   };
}

/**
 * Steps the size to the next ladder value above (`+1`) or below (`-1`) the current size, clamped to the
 * bounds. Off-ladder sizes step to the nearest ladder value in that direction (or a fixed step past the ends).
 */
export function steppedTextSize(current: number, direction: 1 | -1): number {
   if (direction === 1) {
      const next = TEXT_SIZE_PRESETS.find((preset) => preset > current);
      return Math.min(MAX_TEXT_SIZE, next ?? current + 8);
   }
   const prev = [...TEXT_SIZE_PRESETS].reverse().find((preset) => preset < current);
   return Math.max(MIN_TEXT_SIZE, prev ?? current - 8);
}
