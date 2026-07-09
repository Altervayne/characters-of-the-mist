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
 * Adds a note's referenced asset hashes to `into` (the accumulating-set variant, for walk callers): its
 * inline body images AND its note-level cover image. The cover is a note property, not a body token, so it
 * must be folded in HERE - the one place export and the GC both walk a note - or the sweep reclaims a saved
 * note's cover while export still bundles it (or vice versa), the exact silent data loss this helper prevents.
 */
export function collectFromNote(note: Note, into: Set<string>): void {
   for (const hash of collectNoteAssetHashes(note.body)) into.add(hash);
   if (note.cover) into.add(note.cover.hash);
}
