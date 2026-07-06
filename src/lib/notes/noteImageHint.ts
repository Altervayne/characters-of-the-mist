/*
 * The layout hint grammar for a Note's inline images. Everything rides in the image TITLE
 * (`![alt](asset:HASH "align width")`) - no new markdown, no sidecar state, one image = one token, the
 * body stays a flat markdown string. This module is the single home for the grammar: parse, serialize,
 * clamp, and the shipped size-word aliases all live here, so NoteImage, the inspector, and the tests
 * read one truth. It also owns the two pure body helpers - find every image token, rewrite ONE token's
 * hint/alt - that the inspector and resize handle splice against.
 *
 * Nothing here is persisted beyond the body string; a layout is always derived by parsing the title.
 */

/** The four preset positions an inline image can take. */
export type NoteImageAlign = 'left' | 'right' | 'center' | 'full';

/** A resolved image layout. `widthPct` is clamped to the align's band; ignored (rendered 100%) when `full`. */
export interface NoteImageLayout {
   align: NoteImageAlign;
   widthPct: number;
}

/** Per-align width clamp bands (percent of the prose measure). `full` is pinned to 100%. */
const WIDTH_BAND: Record<NoteImageAlign, { min: number; max: number }> = {
   left: { min: 25, max: 55 },
   right: { min: 25, max: 55 },
   center: { min: 30, max: 100 },
   full: { min: 100, max: 100 },
};

/** The default layout for an image with no (or a garbage) hint: a centered full-measure block, as shipped. */
const DEFAULT_LAYOUT: NoteImageLayout = { align: 'center', widthPct: 100 };

/** A sensible width for a float with an align but no width (the float band's rounded midpoint). */
const FLOAT_DEFAULT_WIDTH = 40;

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
      if (widthPct === null && /^\d+%?$/.test(token)) {
         widthPct = parseInt(token, 10);
      }
      // Anything else is ignored (forward-compat).
   }

   if (align === null) align = DEFAULT_LAYOUT.align;
   if (align === 'full') return { align: 'full', widthPct: 100 };
   // A float named without a width sits at its band's midpoint; center without a width stays full-measure.
   if (widthPct === null) widthPct = align === 'center' ? 100 : FLOAT_DEFAULT_WIDTH;
   return { align, widthPct: clampWidth(align, widthPct) };
}

/**
 * Serializes a layout back to the MINIMAL title string, or `undefined` when the title should be omitted
 * (the default `center 100`). Inverse of {@link parseImageHint} for every non-default state, so
 * parse -> tweak -> serialize -> parse is idempotent (clean undo, no body churn). Never emits `%`; drops
 * the width for `full`.
 */
export function serializeImageHint(layout: NoteImageLayout): string | undefined {
   const { align } = layout;
   if (align === 'full') return 'full';
   const widthPct = clampWidth(align, layout.widthPct);
   if (align === 'center' && widthPct === 100) return undefined; // the default: no title
   return `${align} ${widthPct}`;
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

// ==================
//  Auto-glue: a floated image wraps only when it opens the paragraph it should wrap into
// ==================

/*
 * A floated image (CommonMark) wraps prose ONLY when it is the FIRST inline child of the paragraph the
 * prose belongs to - i.e. the token sits on the same line as the text, no blank line between. So setting
 * float-left/right also GLUES the token onto the start of the next paragraph (collapse the blank line to
 * a single space); switching back to center/full UN-GLUES (restore the blank line so the image is its own
 * block). These are pure body transforms, keyed on the token at `index`.
 */

/** The length of the image token that starts at `index`, or `null` when none does. */
function tokenLengthAt(body: string, index: number): number | null {
   const match = /^!\[[^\]]*\]\(asset:[0-9a-f]{6,}(?:\s+"[^"]*")?\)/.exec(body.slice(index));
   return match ? match[0].length : null;
}

/**
 * Whether the text `after` an image (the body slice starting just past the token) opens with a plain
 * PARAGRAPH block - i.e. auto-glue is safe. A heading (`#`), list (`-`/`*`/`+`/`1.`), blockquote (`>`),
 * fence (```` ``` ````), hr, or another image is NOT a paragraph, so we never glue into it.
 */
function nextBlockIsParagraph(after: string): boolean {
   const trimmedLead = after.replace(/^[ \t]*/, '');
   if (trimmedLead.length === 0) return false;
   // Block openers that are NOT a paragraph.
   if (/^(#{1,6}\s|>|\d+[.)]\s|[-*+]\s|```|~~~|-{3,}\s*$|!\[)/.test(trimmedLead)) return false;
   return true;
}

/**
 * Glues the image at `index` onto the start of the following paragraph so a float wraps at once: collapses
 * the single blank line (`\n\n`, tolerating trailing spaces) between the token and a paragraph block into
 * one space. Degrades gracefully - returns the body unchanged when the token is missing, the gap isn't a
 * lone blank line, or the next block isn't a paragraph (heading / list / another image / none).
 */
export function glueImageToNextParagraph(body: string, index: number): string {
   const length = tokenLengthAt(body, index);
   if (length === null) return body;
   const tokenEnd = index + length;
   const after = body.slice(tokenEnd);
   // Already glued (token then a space then text on the same line): nothing to do.
   if (/^[ \t]+\S/.test(after) && !/^[ \t]*\n/.test(after)) return body;
   // The gap must be exactly ONE blank line (a paragraph break), then a paragraph block.
   const gap = /^[ \t]*\n[ \t]*\n[ \t]*/.exec(after);
   if (!gap) return body;
   const rest = after.slice(gap[0].length);
   if (!nextBlockIsParagraph(rest)) return body;
   return `${body.slice(0, tokenEnd)} ${rest}`;
}

/**
 * Un-glues the image at `index` back into its own block so center/full renders as a standalone figure:
 * restores a blank line between the token and any text that currently runs on from it (a single space or
 * a single newline). Returns the body unchanged when the token is missing or already stands alone (a blank
 * line already follows, or nothing follows).
 */
export function unglueImageFromParagraph(body: string, index: number): string {
   const length = tokenLengthAt(body, index);
   if (length === null) return body;
   const tokenEnd = index + length;
   const after = body.slice(tokenEnd);
   // Glued on the same line: `<token> text` -> `<token>\n\ntext`.
   const sameLine = /^[ \t]+(\S)/.exec(after);
   if (sameLine) return `${body.slice(0, tokenEnd)}\n\n${after.replace(/^[ \t]+/, '')}`;
   // A single newline (not a blank line): promote to a paragraph break.
   const singleNewline = /^\n(?!\n)[ \t]*(\S)/.exec(after);
   if (singleNewline) return `${body.slice(0, tokenEnd)}\n\n${after.replace(/^\n[ \t]*/, '')}`;
   return body; // already its own block (blank line follows, or end of body)
}

/**
 * Sets the align of the image at `index` and reconciles its glue so the render matches at once: rewrite
 * the hint, then glue for a float (wrap the next paragraph) or un-glue for center/full (stand alone).
 * The token START offset is stable across the hint rewrite, so the glue step re-reads the token there.
 * The single entry point the inspector's align control calls.
 */
export function setImageAlignAt(body: string, index: number, align: NoteImageAlign, widthPct: number): string {
   const rewritten = rewriteImageHintAt(body, index, { align, widthPct });
   if (align === 'left' || align === 'right') return glueImageToNextParagraph(rewritten, index);
   return unglueImageFromParagraph(rewritten, index);
}
