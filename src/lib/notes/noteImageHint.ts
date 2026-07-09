/*
 * The layout hint grammar for a Note's inline images. Everything rides in the image TITLE
 * (`![alt](asset:HASH "align width")`) - no new markdown, no sidecar state, one image = one token, the
 * body stays a flat markdown string. This module is the single home for the grammar: parse, serialize,
 * clamp, and the shipped size-word aliases all live here, so NoteImage, the live editor, and the tests
 * read one truth. It also owns the pure body helpers - find every image token, rewrite ONE token's
 * hint/alt - that the live editor's align/resize controls splice against.
 *
 * Nothing here is persisted beyond the body string; a layout is always derived by parsing the title.
 */

/** The four preset positions an inline image can take. */
export type NoteImageAlign = 'left' | 'right' | 'center' | 'full';

/**
 * A resolved image layout. `widthPct` is clamped to the align's band; ignored (rendered 100%) when `full`.
 * `aspect` (= height / width) is OPTIONAL: `null` means "no fixed box" - the image renders at its natural
 * ratio (object-contain), the shipped behaviour. A number means a FIXED BOX (`width%` by `aspect`) the image
 * fills via `object-fit: cover`, like the note cover - set once the user drags the resize handle.
 */
export interface NoteImageLayout {
   align: NoteImageAlign;
   widthPct: number;
   aspect: number | null;
}

/** Aspect (= height / width) clamp band for a fixed-box image (mirrors the cover's band). */
export const IMAGE_MIN_ASPECT = 0.2;
export const IMAGE_MAX_ASPECT = 3.0;

/** Clamps an aspect into the box band (for a positive/finite value). */
export function clampImageAspect(aspect: number): number {
   if (!Number.isFinite(aspect) || aspect <= 0) return 1;
   return Math.min(IMAGE_MAX_ASPECT, Math.max(IMAGE_MIN_ASPECT, aspect));
}

/** Per-align width clamp bands (percent of the prose measure). `full` is pinned to 100%. */
const WIDTH_BAND: Record<NoteImageAlign, { min: number; max: number }> = {
   left: { min: 25, max: 55 },
   right: { min: 25, max: 55 },
   center: { min: 30, max: 100 },
   full: { min: 100, max: 100 },
};

/** The default layout for an image with no (or a garbage) hint: a centered full-measure block, as shipped. */
const DEFAULT_LAYOUT: NoteImageLayout = { align: 'center', widthPct: 100, aspect: null };

/** A sensible width for a left/right-aligned image with no width (its band's rounded midpoint). */
const SIDE_DEFAULT_WIDTH = 40;

/**
 * The shipped Phase-2 size words, kept as PARSE-TIME aliases (they rendered as centered blocks): a word
 * expands to `center <bucket>` before the normal parse continues. The only place the bucket numbers live.
 */
const SIZE_ALIAS: Record<string, { align: NoteImageAlign; widthPct: number }> = {
   small: { align: 'center', widthPct: 30 },
   medium: { align: 'center', widthPct: 50 },
   // `full` is a first-class align, handled below; listed for completeness of the shipped trio.
   full: { align: 'full', widthPct: 100 },
};

/** Clamps `widthPct` into `align`'s band, rounding a non-integer in. Out-of-range clamps (never rejects). */
function clampWidth(align: NoteImageAlign, widthPct: number): number {
   const band = WIDTH_BAND[align];
   if (!Number.isFinite(widthPct)) return align === 'full' ? 100 : band.max;
   return Math.min(band.max, Math.max(band.min, Math.round(widthPct)));
}

/** Whether `token` names an align. */
function asAlign(token: string): NoteImageAlign | null {
   return token === 'left' || token === 'right' || token === 'center' || token === 'full' ? token : null;
}

/**
 * Parses an image title into a resolved {@link NoteImageLayout}. Tolerant by design: unknown tokens are
 * ignored (forward-compat), missing/garbage input falls to the default, and `%` is accepted on parse
 * (never emitted). Order is align-then-width, but either may be absent. The result is always clamped.
 */
export function parseImageHint(title: string | undefined): NoteImageLayout {
   if (!title) return { ...DEFAULT_LAYOUT };
   const tokens = title.trim().toLowerCase().split(/\s+/).filter(Boolean);
   if (tokens.length === 0) return { ...DEFAULT_LAYOUT };

   let align: NoteImageAlign | null = null;
   let widthPct: number | null = null;
   let aspect: number | null = null;

   for (const token of tokens) {
      // A shipped size word expands to its aliased align+width, then the loop continues.
      const alias = SIZE_ALIAS[token];
      if (alias) {
         if (align === null) align = alias.align;
         if (widthPct === null && alias.align !== 'full') widthPct = alias.widthPct;
         continue;
      }
      const maybeAlign = asAlign(token);
      if (maybeAlign && align === null) {
         align = maybeAlign;
         continue;
      }
      // The first bare integer(%) is the WIDTH; the next numeric token (integer or decimal) is the ASPECT.
      if (widthPct === null && /^\d+%?$/.test(token)) {
         widthPct = parseInt(token, 10);
         continue;
      }
      if (aspect === null && /^\d+(?:\.\d+)?$/.test(token)) {
         aspect = clampImageAspect(parseFloat(token));
         continue;
      }
      // Anything else is ignored (forward-compat).
   }

   if (align === null) align = DEFAULT_LAYOUT.align;
   if (align === 'full') return { align: 'full', widthPct: 100, aspect };
   // A left/right image without a width sits at its band's midpoint; center without a width stays full-measure.
   if (widthPct === null) widthPct = align === 'center' ? 100 : SIDE_DEFAULT_WIDTH;
   return { align, widthPct: clampWidth(align, widthPct), aspect };
}

/**
 * Serializes a layout back to the MINIMAL title string, or `undefined` when the title should be omitted
 * (the default `center 100`). Inverse of {@link parseImageHint} for every non-default state, so
 * parse -> tweak -> serialize -> parse is idempotent (clean undo, no body churn). Never emits `%`; drops
 * the width for `full`.
 */
export function serializeImageHint(layout: NoteImageLayout): string | undefined {
   const { align, aspect } = layout;
   // Aspect (a fixed box) can accompany any align, including `full` (a full-width banner of a fixed ratio).
   const aspectPart = aspect != null ? ` ${round2(clampImageAspect(aspect))}` : '';
   if (align === 'full') return aspect != null ? `full 100${aspectPart}` : 'full';
   const widthPct = clampWidth(align, layout.widthPct);
   if (align === 'center' && widthPct === 100 && aspect == null) return undefined; // the default: no title
   return `${align} ${widthPct}${aspectPart}`;
}

/** Rounds an aspect to 2 decimals so the serialized title stays short + stable (idempotent round-trip). */
function round2(n: number): number {
   return Math.round(n * 100) / 100;
}

// ==================
//  Body token helpers (pure; the inspector + resize splice against these)
// ==================

/** One inline image token located in the body, with its byte span and parsed parts. */
export interface ImageToken {
   /** Start offset of the whole `![alt](asset:HASH "title")` token in the body. */
   index: number;
   /** Length of the token, so `[index, index+length)` is its exact span. */
   length: number;
   /** The content-addressed asset hash (the src, minus `asset:`). */
   hash: string;
   /** The raw title string (the layout hint), or `''` when the token has no title. */
   title: string;
   /** The alt text (the rendered caption), or `''`. */
   alt: string;
}

/*
 * Matches a Note asset-image token: `![alt](asset:HASH "title")`, title optional. The hash capture is
 * `[0-9a-f]{6,}` (same family as the hash helper), the alt is everything up to `]`, the title everything
 * inside the quotes. Global so `matchAll` walks every token in order.
 */
const IMAGE_TOKEN_RE = /!\[([^\]]*)\]\(asset:([0-9a-f]{6,})(?:\s+"([^"]*)")?\)/g;

/** Finds every asset-image token in `body`, in document order. */
export function findImageTokens(body: string): ImageToken[] {
   const tokens: ImageToken[] = [];
   for (const match of body.matchAll(IMAGE_TOKEN_RE)) {
      tokens.push({
         index: match.index,
         length: match[0].length,
         alt: match[1] ?? '',
         hash: match[2],
         title: match[3] ?? '',
      });
   }
   return tokens;
}

/**
 * Returns the token whose span CONTAINS `caret` (inclusive of the closing paren, so a caret at the very
 * end of a token still counts as inside it), or `null` when the caret sits in no image. This is the
 * caret-anchored "active image" the inspector keys off - identified by ABSOLUTE OFFSET, never by hash,
 * so the same asset used twice never collides.
 */
export function activeImageTokenAt(body: string, caret: number): ImageToken | null {
   for (const token of findImageTokens(body)) {
      if (caret >= token.index && caret <= token.index + token.length) return token;
   }
   return null;
}

/**
 * Rebuilds one image token from its parts. Emits `![alt](asset:HASH)` at the default (no title), else
 * `![alt](asset:HASH "title")`. A blank `title` drops the title entirely, keeping the body minimal.
 */
export function buildImageToken(hash: string, alt: string, title: string | undefined): string {
   const titlePart = title && title.length > 0 ? ` "${title}"` : '';
   return `![${alt}](asset:${hash}${titlePart})`;
}

/**
 * Rewrites the ONE image token at byte offset `index` (its `length` known from {@link findImageTokens}),
 * swapping its layout hint and (optionally) its alt, leaving the rest of the body byte-identical. The
 * `asset:HASH` src is never touched, so the shared hash helper stays correct. Returns the new body; a
 * no-op (returns the input) when the offset doesn't start an image token.
 */
export function rewriteImageHintAt(
   body: string,
   index: number,
   layout: NoteImageLayout,
   alt?: string,
): string {
   const rest = body.slice(index);
   const match = /^!\[([^\]]*)\]\(asset:([0-9a-f]{6,})(?:\s+"([^"]*)")?\)/.exec(rest);
   if (!match) return body;
   const length = match[0].length;
   const hash = match[2];
   const nextAlt = alt ?? match[1] ?? '';
   const rebuilt = buildImageToken(hash, nextAlt, serializeImageHint(layout));
   return body.slice(0, index) + rebuilt + body.slice(index + length);
}

/**
 * Maps a resize-drag delta to a snapped width percent of the prose column. `startPct` is the width at
 * pointer-down, `deltaPx` the horizontal drag distance, `columnPx` the column width cached at pointer-down.
 * Snaps to 5% steps (round numbers); the caller's `parseImageHint`/`rewriteImageHintAt` clamps into the
 * align band. Pure - the drag handler is a thin wrapper so the math is unit-tested without a pointer.
 */
export function resizeWidthPct(startPct: number, deltaPx: number, columnPx: number): number {
   const safeColumn = columnPx > 0 ? columnPx : 1;
   const raw = startPct + (deltaPx / safeColumn) * 100;
   return Math.round(raw / 5) * 5;
}
