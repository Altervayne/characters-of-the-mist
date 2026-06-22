// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { detachToCopy, toCopyContent, toReferenceContent } from './referenceContent';

// -- Type Imports --
import type { CardBoardContent } from '@/lib/types/board';

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
