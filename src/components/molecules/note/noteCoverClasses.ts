/*
 * Shared sizing for a note's COVER image, imported by both render paths so they cannot drift: the
 * react-markdown Reading render ({@link import('../NoteDocument').NoteDocument}) and the CM6 Live gutter
 * ({@link import('../../organisms/note/live/coverGutter').coverGutter}). A note-level cover is rendered
 * top-left with the opening text beside it (a real `float:left` in Reading; a `padding-left` line-inset +
 * absolute overlay in Live - the honest-cursor mechanism CM6 needs, since a float is invisible to its
 * line-map). Both paths read the SAME width/aspect off `NoteCover` so the mode switch never jumps. The cover
 * is a fixed box (`width` % of the measure by `aspect`) the image fills via `object-fit: cover`.
 */

/**
 * The default cover box width, as a percent of the 68ch prose measure (Reading) / the content width (Live):
 * ~38%, a magazine drop-cap proportion that leaves a comfortable text column beside it. A cover is resizable,
 * so its live width lives on `NoteCover.width`; this is only the starting value.
 */
export const COVER_DEFAULT_WIDTH_PCT = 38;

/** Width clamp band (percent of the measure): a cover can shrink to a sidebar or grow to a wide banner. */
export const COVER_MIN_WIDTH_PCT = 20;
export const COVER_MAX_WIDTH_PCT = 80;

/**
 * Aspect (= height / width) clamp band. Free-form drag (Shift) shapes the cover, so the band is wide - a
 * short banner down to ~0.2, a tall portrait up to 3.0 - and only guards the degenerate sliver/tower extremes.
 */
export const COVER_MIN_ASPECT = 0.2;
export const COVER_MAX_ASPECT = 3.0;

/** Aspect-ratio presets offered in the cover controls, plus `free` (keep the current custom aspect). */
export const COVER_ASPECT_PRESETS: { key: string; ratio: number }[] = [
   { key: 'wide', ratio: 9 / 16 },
   { key: 'photo', ratio: 2 / 3 },
   { key: 'square', ratio: 1 },
];

/** The gap between the cover and the text wrapping/insetting beside it (Reading margin / Live inset padding). */
export const COVER_GAP_REM = 1.5;

/** Clamps a width percent into the cover band. */
export function clampCoverWidth(pct: number): number {
   return Math.min(COVER_MAX_WIDTH_PCT, Math.max(COVER_MIN_WIDTH_PCT, Math.round(pct)));
}

/** Clamps an aspect ratio into the cover band. */
export function clampCoverAspect(aspect: number): number {
   if (!Number.isFinite(aspect) || aspect <= 0) return 1;
   return Math.min(COVER_MAX_ASPECT, Math.max(COVER_MIN_ASPECT, aspect));
}
