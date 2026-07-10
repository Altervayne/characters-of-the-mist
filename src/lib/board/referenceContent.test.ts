// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { detachToCopy, detachNoteToCopy, materializeCopyAsReference, toCopyContent, toReferenceContent } from './referenceContent';

// -- Type Imports --
import type { CardBoardContent, NoteBoardContent, Note } from '@/lib/types/board';

/*
 * Tests for the copy <-> reference content transforms. These pin the content SHAPE each
 * toggle produces and the dangling detach (live-or-lastKnown) behaviour.
 */

describe('reference content transforms', () => {
   it('copy -> reference drops data and keeps the source link', () => {
      const copy: CardBoardContent = { kind: 'card', mode: 'copy', sourceDrawerItemId: 'src-1', data: { cardType: 'CHARACTER_CARD' } };

      const ref = toReferenceContent(copy, copy.sourceDrawerItemId!);

      expect(ref).toEqual({ kind: 'card', mode: 'reference', sourceDrawerItemId: 'src-1' });
      expect('data' in ref).toBe(false);
   });

   it('reference -> copy snapshots the live content into data, keeping the source link', () => {
      const ref: CardBoardContent = { kind: 'card', mode: 'reference', sourceDrawerItemId: 'src-1' };
      const live = { cardType: 'CHARACTER_CARD', details: { game: 'LEGENDS', name: 'live' } };

      const copy = detachToCopy(ref, live);

      expect(copy.mode).toBe('copy');
      expect(copy.sourceDrawerItemId).toBe('src-1');
      expect((copy as { data: unknown }).data).toEqual(live);
   });

   it('detach falls back to lastKnown when the source is dangling (no live content)', () => {
      const lastKnown = { cardType: 'CHARACTER_CARD', details: { game: 'LEGENDS', name: 'cached' } };
      const dangling: CardBoardContent = { kind: 'card', mode: 'reference', sourceDrawerItemId: 'gone', lastKnown };

      const copy = detachToCopy(dangling, null);

      expect(copy.mode).toBe('copy');
      expect((copy as { data: unknown }).data).toEqual(lastKnown);
   });

   it('detached copy is independent of the source object (deep clone)', () => {
      const live = { details: { name: 'orig' } };
      const copy = detachToCopy({ kind: 'card', mode: 'reference', sourceDrawerItemId: 's' }, live);

      live.details.name = 'mutated';

      expect(((copy as { data: { details: { name: string } } }).data).details.name).toBe('orig');
   });

   it('toCopyContent preserves the kind for trackers', () => {
      const copy = toCopyContent({ kind: 'tracker', mode: 'reference', sourceDrawerItemId: 's' }, { trackerType: 'STATUS' });
      expect(copy.kind).toBe('tracker');
      expect(copy.mode).toBe('copy');
   });
});

describe('detachNoteToCopy', () => {
   it('reference -> copy snapshots the live note into data, keeping the source link', () => {
      const ref: NoteBoardContent = { kind: 'note', mode: 'reference', noteId: 'n-1', sourceDrawerItemId: 'src-1' };
      const live: Note = { id: 'n-1', title: 'Baron', body: 'His history.' };

      const copy = detachNoteToCopy(ref, live);

      expect(copy).toEqual({ kind: 'note', mode: 'copy', sourceDrawerItemId: 'src-1', data: live });
   });

   it('falls back to lastKnown when the source is dangling (no live note)', () => {
      const lastKnown: Note = { id: 'n-1', title: 'Cached Baron', body: 'cached body' };
      const dangling: NoteBoardContent = { kind: 'note', mode: 'reference', noteId: 'n-1', sourceDrawerItemId: 'gone', lastKnown };

      const copy = detachNoteToCopy(dangling, null);

      expect(copy.mode).toBe('copy');
      expect((copy as { data: Note }).data).toEqual(lastKnown);
   });

   it('produces a copy independent of the source note (deep clone)', () => {
      const live: Note = { id: 'n-1', title: 'orig', body: 'orig body' };
      const copy = detachNoteToCopy({ kind: 'note', mode: 'reference', noteId: 'n-1', sourceDrawerItemId: 's' }, live);

      live.title = 'mutated';

      expect((copy as { data: Note }).data.title).toBe('orig');
   });

   it('degrades a snapshot-less reference to a fresh empty note (never null data)', () => {
      const copy = detachNoteToCopy({ kind: 'note', mode: 'reference', noteId: 'n-1', sourceDrawerItemId: 's' }, null);
      const data = (copy as { data: Note }).data;
      expect(copy.mode).toBe('copy');
      expect(data.title).toBe('');
      expect(data.body).toBe('');
      expect(typeof data.id).toBe('string');
   });
});

describe('materializeCopyAsReference (adopt-on-open)', () => {
   it('materializes a fresh note (new id) and a reference keyed to it, no drawer parent', () => {
      const data: Note = { id: 'old-copy-id', title: 'Baron', body: 'lore' };

      const { note, content } = materializeCopyAsReference(data);

      expect(note.id).not.toBe('old-copy-id'); // a real, standalone note gets a new id
      expect(note.title).toBe('Baron');
      expect(note.body).toBe('lore');
      expect(content).toEqual({ kind: 'note', mode: 'reference', noteId: note.id, sourceDrawerItemId: undefined, lastKnown: note });
   });

   it('deep-clones so the materialized note (and lastKnown) share nothing with the copy data', () => {
      const data: Note = { id: 'c', title: 'orig', body: 'body', cover: { hash: 'h', width: 40, aspect: 1.5 } };

      const { note, content } = materializeCopyAsReference(data);
      data.title = 'mutated';
      data.cover!.width = 99;

      expect(note.title).toBe('orig');
      expect(note.cover!.width).toBe(40);
      expect((content as { lastKnown: Note }).lastKnown.title).toBe('orig');
   });
});
