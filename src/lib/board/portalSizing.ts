/*
 * A portal tile is user-resizable in all four styles, so its icon + text must scale with the box - but
 * crisply: real px derived from the box height (never a `transform: scale`, which blurs). These are the pure
 * derivations, shared by the board tile and the editor's live preview. Height drives the type/glyph scale
 * (width only gives the label room to truncate); an icon-only face scales off the SHORTER side so it stays a
 * square at any aspect. Base height 48 reproduces the 1a look (text 14px, icon 20px); every scale is clamped
 * so a min-size box stays legible + clickable and a large one doesn't run away.
 */

/** The 1a create footprint: the icon+text smart-default drop size and the natural starting point for a resize. */
export const PORTAL_BASE_SIZE = { width: 168, height: 48 };
/** The resize floor: below this a portal stops being legible + comfortably clickable. */
export const PORTAL_MIN_SIZE = { width: 56, height: 32 };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** The label font size (px) for a portal box of `boxHeight`. */
export function portalFontPx(boxHeight: number): number {
   return clamp(Math.round(boxHeight * 0.3), 11, 26);
}

/** The icon size (px) beside a label (icon+text / poster) for a portal box of `boxHeight`. */
export function portalIconPx(boxHeight: number): number {
   return clamp(Math.round(boxHeight * 0.42), 14, 40);
}

/** The glyph size (px) for a label-less icon-only face: a square scaled off the shorter box side. */
export function portalIconOnlyPx(boxWidth: number, boxHeight: number): number {
   return clamp(Math.round(Math.min(boxWidth, boxHeight) * 0.55), 16, 88);
}
