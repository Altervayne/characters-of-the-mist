// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { collectFromNote, collectNoteAssetHashes } from './noteAssets';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * The shared note asset-hash extractor is the single grammar both the export asset-collection and the GC
 * mark-phase depend on. If it drifts, an image survives an export but is swept at home (or vice versa), a
 * silent data loss. These tests pin the grammar it must keep.
 */

const HASH_A = 'a1b2c3d4e5f6';
const HASH_B = 'f6e5d4c3b2a1';

function note(body: string): Note {
   return { id: 'note-1', title: 'T', body };
}

describe('collectNoteAssetHashes', () => {
   it('extracts a single asset hash from an inline image', () => {
      expect(collectNoteAssetHashes(`![a map](asset:${HASH_A})`)).toEqual(new Set([HASH_A]));
   });

   it('extracts multiple distinct hashes and dedups repeats', () => {
      const body = `![](asset:${HASH_A})\n\ntext\n\n![](asset:${HASH_B})\n\n![again](asset:${HASH_A})`;
      expect(collectNoteAssetHashes(body)).toEqual(new Set([HASH_A, HASH_B]));
   });

   it('honors an image with a size-hint title', () => {
      expect(collectNoteAssetHashes(`![alt](asset:${HASH_A} "small")`)).toEqual(new Set([HASH_A]));
   });

   it('is not fooled by a richer align+width layout title (the anti-data-loss guarantee)', () => {
      // The hash lives strictly LEFT of the title; the layout hint (`left 40`) must never break the mark.
      expect(collectNoteAssetHashes('![](asset:abc123 "left 40")')).toEqual(new Set(['abc123']));
   });

   it('ignores http(s) and non-asset image srcs', () => {
      const body = '![remote](https://example.com/x.png)\n\n![path](/local/y.png)';
      expect(collectNoteAssetHashes(body).size).toBe(0);
   });

   it('returns an empty set for an image-free or empty body', () => {
      expect(collectNoteAssetHashes('# Just prose, no images').size).toBe(0);
      expect(collectNoteAssetHashes('').size).toBe(0);
   });

   it('accumulates into an existing set via collectFromNote', () => {
      const into = new Set<string>(['pre-existing']);
      collectFromNote(note(`![](asset:${HASH_A})`), into);
      expect(into).toEqual(new Set(['pre-existing', HASH_A]));
   });
});

describe('collectFromNote: the cover image (a note property, not a body token)', () => {
   it('collects the cover hash alongside the body image hashes', () => {
      const into = new Set<string>();
      collectFromNote({ id: 'n', title: 'T', body: `![](asset:${HASH_A})`, cover: { hash: HASH_B, width: 38, aspect: 1 } }, into);
      expect(into).toEqual(new Set([HASH_A, HASH_B]));
   });

   it('collects the cover of a body-image-free note (so the sweep never reclaims it)', () => {
      const into = new Set<string>();
      collectFromNote({ id: 'n', title: 'T', body: 'just prose', cover: { hash: HASH_A, width: 38, aspect: 1 } }, into);
      expect(into).toEqual(new Set([HASH_A]));
   });

   it('adds nothing extra when there is no cover', () => {
      const into = new Set<string>();
      collectFromNote(note('just prose'), into);
      expect(into.size).toBe(0);
   });
});
