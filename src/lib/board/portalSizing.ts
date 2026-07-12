/*
 * A portal tile is user-resizable in every style, so its icon + text must scale with the box - but crisply:
 * real px derived from the box height (never a `transform: scale`, which blurs). These are the pure
 * derivations, shared by the board tile and the editor's live preview. Height drives the type/glyph scale
 * (width only gives the label room to truncate); an icon-only face scales off the SHORTER side so it stays a
 * square at any aspect. Base height 48 reproduces the 1a look (text 14px, icon 20px); every scale is clamped
 * so a min-size box stays legible + clickable and a large one doesn't run away. The composed visual+text
 * layout also derives its flex direction here (the label's side of the visual), from `PortalAlign`.
 */

// -- Type Imports --
import type { PortalAlign } from '@/lib/types/board';

/** The 1a create footprint: the icon+text smart-default drop size and the natural starting point for a resize. */
export const PORTAL_BASE_SIZE = { width: 168, height: 48 };
/** The resize floor: below this a portal stops being legible + comfortably clickable. */
export const PORTAL_MIN_SIZE = { width: 56, height: 32 };
/** A fresh composed image's fill fraction (the 0-1 `size`): a mid thumbnail that reads beside the label. */
export const PORTAL_IMAGE_SIZE_DEFAULT = 0.55;

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

/**
 * The composed image thumbnail's side (px): the user's 0-1 `size` fraction of the box height (so it scales
 * with a box resize AND the slider), clamped so it stays visible and can't run away. `size` is clamped to a
 * legible-but-not-full range first (a full-box thumbnail would swamp the label).
 */
export function portalImageThumbPx(boxHeight: number, size: number): number {
   return clamp(Math.round(boxHeight * clamp(size, 0.1, 1) * 0.85), 12, 600);
}

/**
 * How many lines a wrapped label may show before it clips, derived from the box height so a multiline label
 * never spills the box. `reservedPx` is the vertical space the visual already claims (a stacked top/bottom
 * composed layout); a beside layout or text-only passes 0. Always at least one line.
 */
export function portalLabelMaxLines(boxHeight: number, fontPx: number, reservedPx = 0): number {
   const available = boxHeight - fontPx * 0.8 - reservedPx;
   return clamp(Math.floor(available / (fontPx * 1.3)), 1, 6);
}

/**
 * The composed visual+text layout's flex direction, driven by which side the label sits on: `right` = row
 * (visual then label), `left` = row-reverse, `bottom` = column (visual over label), `top` = column-reverse.
 */
export function portalAlignFlexDirection(align: PortalAlign): 'row' | 'row-reverse' | 'column' | 'column-reverse' {
   switch (align) {
      case 'right': return 'row';
      case 'left': return 'row-reverse';
      case 'bottom': return 'column';
      case 'top': return 'column-reverse';
   }
}
