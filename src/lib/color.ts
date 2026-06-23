/*
 * Small color helpers shared by the board's color-able items. Dependency-free.
 */

/** Parses a `#rrggbb` hex (with or without the `#`) to `[r, g, b]`, or null when malformed. */
export function hexToRgb(hex: string): [number, number, number] | null {
   const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
   return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null;
}

/** Near-black / near-white text colors, picked to read on a colored background. */
const DARK_TEXT = '#1c1917';
const LIGHT_TEXT = '#f5f5f4';

/**
 * Returns a legible text color for text drawn on `background`, chosen by the background's
 * perceived luminance: dark text on light pastels, light text on dark customs, so a note
 * stays readable on any color. An unparseable color falls back to dark text.
 */
export function readableTextColor(background: string): string {
   const rgb = hexToRgb(background);
   if (!rgb) return DARK_TEXT;
   const [red, green, blue] = rgb;
   // sRGB-weighted luminance, 0..1; the 0.6 threshold leans toward dark text on pastels.
   const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
   return luminance > 0.6 ? DARK_TEXT : LIGHT_TEXT;
}
