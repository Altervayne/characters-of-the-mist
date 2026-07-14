// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * The ONE shared extractor for the asset hashes a Note references. A Note's inline images ride
 * INSIDE its markdown `body` as `![alt](asset:<hash>)`, so the only way to know a note's images is
 * to parse the body. Both the export asset-collection AND the GC mark-phase call THIS helper - if
 * they used two different regexes, an image could survive an export but get swept at home (or vice
 * versa), a silent data loss that only surfaces on the periodic GC sweep days later. One grammar,
 * one home.
 */

/**
 * The markdown image scheme for a stored asset: `asset:<sha256-hex>`, optionally with a size hint in
 * the image title. The hash is the same content-addressed sha256 the portrait/board images use.
 * `[0-9a-f]{6,}` matches a hex hash while rejecting a stray `asset:` with no hash.
 */
const ASSET_URL_RE = /asset:([0-9a-f]{6,})/g;

/** Returns the set of asset hashes referenced by a note `body`'s inline images. Empty for an image-free note. */
export function collectNoteAssetHashes(body: string): Set<string> {
   const hashes = new Set<string>();
   if (!body) return hashes;
   for (const match of body.matchAll(ASSET_URL_RE)) {
      hashes.add(match[1]);
   }
   return hashes;
}

/**
 * A markdown inline link, `[label](href)`. The href capture stops at the first whitespace or `)` so a
 * `[a](url "title")` link drops its title and keeps the bare url. Deliberately a HEURISTIC scanner, not a
 * grammar parse (see {@link collectNoteLinkHrefs}): it can match a `[x](y)` inside a fenced code block, an
 * accepted false positive for a navigation tree. An image embed `![alt](asset:hash)` is rejected by the
 * caller (the `!` prefix check), so an inline image never reads as a link.
 */
const NOTE_LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g;

/**
 * Returns the hrefs of a note `body`'s markdown links, the outbound-edge candidates the Navigator crawls -
 * a sibling of {@link collectNoteAssetHashes} (same `matchAll`-over-body shape). Image embeds
 * (`![...](asset:...)`) are excluded (they are images, not links) and same-note `#section` fragments are
 * dropped (a section is never a cross-workspace edge); the remaining `cotm://` and external hrefs are kept
 * raw for a caller to classify via `parseLinkHref`. A regex scan is a heuristic - a `[x](y)` inside a code
 * fence can slip through, cosmetic for a nav tree - so it must never crash on odd input, only over-collect.
 */
export function collectNoteLinkHrefs(body: string): string[] {
   const hrefs: string[] = [];
   if (!body) return hrefs;
   for (const match of body.matchAll(NOTE_LINK_RE)) {
      // Skip an image embed: the same `[...](...)` shape preceded by `!` is an image, not a link.
      if (match.index > 0 && body[match.index - 1] === '!') continue;
      const href = match[1];
      // A same-note section fragment is not a navigable edge.
      if (href.startsWith('#')) continue;
      hrefs.push(href);
   }
   return hrefs;
}

/**
 * Adds a note's referenced asset hashes to `into` (the accumulating-set variant, for walk callers): its
 * inline body images AND its note-level cover image. The cover is a note property, not a body token, so it
 * must be folded in HERE - the one place export and the GC both walk a note - or the sweep reclaims a saved
 * note's cover while export still bundles it (or vice versa), the exact silent data loss this helper prevents.
 */
export function collectFromNote(note: Note, into: Set<string>): void {
   for (const hash of collectNoteAssetHashes(note.body)) into.add(hash);
   if (note.cover) into.add(note.cover.hash);
}
