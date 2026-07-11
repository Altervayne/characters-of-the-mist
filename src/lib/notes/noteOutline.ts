/*
 * The note document OUTLINE: a pure extractor of a note body's headings, and the shared heading -> slug
 * contract. This is the single source of truth for two features: the outline navigation rail, and (future)
 * in-document links `[text](#slug)`. Both MUST resolve a heading to the SAME slug, so the slug logic lives
 * here once and never forks.
 *
 * Parser-independent LINE SCAN (like `findTableBlocks`), so it needs no CM6 view and runs the same in the
 * editor, the Reading renderer, and the command palette. Detects ATX (`#`..`######`) and setext (a text line
 * underlined by `===` = H1 / `---` = H2) headings, and skips anything inside a fenced code block.
 */

/** One heading in a note body. `from`/`to` are byte offsets of the heading construct (for scroll-to-position). */
export interface NoteHeading {
   /** Heading level 1..6. */
   level: number;
   /** The heading's visible text (trimmed, markers stripped). */
   text: string;
   /** The GitHub-style anchor slug, deduped across the document. The stable contract for `#slug` links. */
   slug: string;
   /** Byte offset where the heading construct starts (the text line's start). */
   from: number;
   /** Byte offset where the heading construct ends (ATX: line end; setext: the underline line's end). */
   to: number;
}

/** An ATX heading line: 1-6 leading `#`, a space, the text, optional trailing `#` run. */
const ATX_RE = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
/** A setext underline: a run of only `=` (H1) or only `-` (H2), optional trailing spaces. */
const SETEXT_RE = /^(=+|-+)[ \t]*$/;
/** A fenced code-block delimiter: at least three backticks or tildes (an info string may follow). */
const FENCE_RE = /^\s*(```+|~~~+)/;
/** Block markers a setext text line must NOT start with (list / quote / ATX / table-ish), else it isn't a heading. */
const NON_SETEXT_LEAD = /^\s*(#|>|[-*+] |\d+[.)] |\|)/;

/**
 * Strips inline markdown to the visible text, so the outline shows a clean title AND its slug matches the
 * Reading renderer's plain-text heading. Handles links/images (`[t](u)`->`t`), bold/italic/strike, and inline
 * code. Not a full parser - enough for heading lines (the slug then strips any residual punctuation anyway).
 */
function stripInline(text: string): string {
   return text
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links / images -> the link text / alt
      .replace(/(\*\*|__)(.*?)\1/g, '$2')        // bold
      .replace(/(\*|_)(.*?)\1/g, '$2')           // italic
      .replace(/~~(.*?)~~/g, '$2')               // strikethrough
      .replace(/`([^`]+)`/g, '$1')               // inline code
      .trim();
}

/**
 * GitHub-style anchor slug: lowercase, strip punctuation (keep letters/numbers/spaces/hyphens, Unicode-aware),
 * spaces -> hyphens, collapse runs of hyphens, trim edge hyphens. An all-punctuation title collapses to
 * `section` so the anchor is always usable. Collision-dedupe is the caller's job ({@link extractHeadings}).
 */
export function slugifyHeading(text: string): string {
   const slug = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
   return slug || 'section';
}

/**
 * Extracts every heading from a note body in document order, with a deduped slug per heading. Repeated titles
 * get `-1`, `-2`, ... suffixes in occurrence order (`Notes`, `Notes` -> `notes`, `notes-1`), matching GitHub.
 * Headings inside fenced code blocks are skipped. Empty-text headings (e.g. a bare `#`) are omitted.
 */
export function extractHeadings(body: string): NoteHeading[] {
   const lines = body.split('\n');
   // Precompute each line's byte offset (accounting for the '\n' separators).
   const starts: number[] = [];
   let off = 0;
   for (const line of lines) { starts.push(off); off += line.length + 1; }

   const raw: Omit<NoteHeading, 'slug'>[] = [];
   let inFence = false;
   let fenceMarker = '';
   for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track fenced code blocks: a fence toggles it; the closing fence must use the same char family.
      const fence = FENCE_RE.exec(line);
      if (fence) {
         const marker = fence[1][0]; // '`' or '~'
         if (!inFence) { inFence = true; fenceMarker = marker; continue; }
         if (marker === fenceMarker) { inFence = false; fenceMarker = ''; continue; }
      }
      if (inFence) continue;

      // ATX: `## Heading`.
      const atx = ATX_RE.exec(line);
      if (atx) {
         const text = stripInline(atx[2].trim());
         if (text) raw.push({ level: atx[1].length, text, from: starts[i], to: starts[i] + line.length });
         continue;
      }

      // Setext: a text line underlined by the NEXT line's `===` (H1) or `---` (H2). The text line must be a
      // plain paragraph line (non-blank, not a list/quote/ATX/table/fence lead) - else `---` is a rule/table.
      const next = i + 1 < lines.length ? lines[i + 1] : undefined;
      if (next !== undefined && SETEXT_RE.test(next) && line.trim() !== '' && !NON_SETEXT_LEAD.test(line)) {
         const level = next.trim()[0] === '=' ? 1 : 2;
         raw.push({ level, text: stripInline(line.trim()), from: starts[i], to: starts[i + 1] + next.length });
         i++; // consume the underline line
      }
   }

   // Dedupe slugs across the document, in occurrence order.
   const seen = new Map<string, number>();
   return raw.map((h) => {
      const base = slugifyHeading(h.text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { ...h, slug: count === 0 ? base : `${base}-${count}` };
   });
}
