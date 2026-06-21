/*
 * Sizing constants for the resizable IMAGE_CARD. Shared by the store (clamping in
 * `setCardSize`), the card component (drag handle + presets), and harmonization (the
 * legacy backfill), so all three agree on bounds and defaults. Values are starting
 * points, tunable later.
 */

/** Smallest a card may be dragged/preset to, in px. */
export const MIN_CARD_PX = 140;
/** Largest a card's width may be, in px - keeps a card from blowing up the flex-wrap grid. */
export const MAX_CARD_PX = 640;
/**
 * Largest a card's height may be, in px - a standard sheet card's height (`h-150`).
 * Capping height here keeps the sheet's card row vertically even (no image card stands
 * taller than its neighbours).
 */
export const MAX_CARD_HEIGHT_PX = 600;

/** Default size for a newly added portrait (a moderate portrait, not the old sliver). */
export const DEFAULT_IMAGE_CARD_SIZE = { width: 280, height: 360 } as const;

/**
 * The pre-resize footprint (the old fixed `w-62.5 h-150`). Harmonization backfills
 * this onto image cards created before sizing existed, so they keep their look.
 */
export const LEGACY_IMAGE_CARD_SIZE = { width: 250, height: 600 } as const;

/** Preset card sizes offered in the resize menu (all within the bounds). */
export const IMAGE_CARD_PRESETS = {
   portrait: { width: 280, height: 360 },
   square: { width: 320, height: 320 },
   landscape: { width: 400, height: 260 },
} as const;

/** Clamps a card WIDTH to the bounds, rounding to a whole pixel. */
export function clampCardWidth(value: number): number {
   return Math.round(Math.min(MAX_CARD_PX, Math.max(MIN_CARD_PX, value)));
}

/** Clamps a card HEIGHT to the bounds (capped at a standard card's height), rounding to a whole pixel. */
export function clampCardHeight(value: number): number {
   return Math.round(Math.min(MAX_CARD_HEIGHT_PX, Math.max(MIN_CARD_PX, value)));
}
