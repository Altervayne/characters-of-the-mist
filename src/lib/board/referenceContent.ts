// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { CardBoardContent, TrackerBoardContent, NoteBoardContent, Note } from '@/lib/types/board';

/*
 * Pure transforms for the copy <-> reference toggle on an embedded board item. Kept
 * framework-free so the content-shape logic is unit-testable without rendering. The
 * functions preserve the item's `kind` (card/tracker) so the result stays a valid
 * discriminated content.
 */

type EmbeddedContent = CardBoardContent | TrackerBoardContent;

/**
 * A self-contained copy carrying `data`, keeping `sourceDrawerItemId` so the copy can be
 * re-referenced later. (A board-9 copy without a source simply can't be re-referenced.)
 */
export function toCopyContent(content: EmbeddedContent, data: unknown): EmbeddedContent {
   return content.kind === 'card'
      ? { kind: 'card', mode: 'copy', sourceDrawerItemId: content.sourceDrawerItemId, data }
      : { kind: 'tracker', mode: 'copy', sourceDrawerItemId: content.sourceDrawerItemId, data };
}

/**
 * A live reference to `sourceDrawerItemId`. Drops any inline `data` (it renders from the
 * drawer); an optional `lastKnown` caches the last successful read for dangling-time
 * convert-to-copy.
 */
export function toReferenceContent(content: EmbeddedContent, sourceDrawerItemId: string, lastKnown?: unknown): EmbeddedContent {
   if (content.kind === 'card') {
      return lastKnown === undefined
         ? { kind: 'card', mode: 'reference', sourceDrawerItemId }
         : { kind: 'card', mode: 'reference', sourceDrawerItemId, lastKnown };
   }
   return lastKnown === undefined
      ? { kind: 'tracker', mode: 'reference', sourceDrawerItemId }
      : { kind: 'tracker', mode: 'reference', sourceDrawerItemId, lastKnown };
}

/**
 * Detaches an embedded item to a copy, snapshotting the best available content: the live
 * content if present, else the cached `lastKnown` (so a dangling reference still yields a
 * usable copy), else whatever the copy already held. The snapshot is deep-cloned so the
 * resulting copy shares nothing with the source.
 */
export function detachToCopy(content: EmbeddedContent, liveContent: unknown): EmbeddedContent {
   const snapshot = content.mode === 'reference' ? (liveContent ?? content.lastKnown ?? null) : (content.data ?? null);
   return toCopyContent(content, snapshot === null ? null : structuredClone(snapshot));
}

/**
 * Detaches a note reference to a frozen copy: snapshots the best available Note - the live-resolved note
 * if present, else the reference's cached `lastKnown` (so a dangling reference still yields a usable copy),
 * else a copy's own data. Deep-cloned so the copy shares nothing with the source, and the `sourceDrawerItemId`
 * is kept. A missing snapshot degrades to a fresh empty note so `data` is always a valid {@link Note}.
 */
export function detachNoteToCopy(content: NoteBoardContent, liveNote: Note | null): NoteBoardContent {
   const snapshot = content.mode === 'reference' ? (liveNote ?? content.lastKnown ?? null) : content.data;
   const data = snapshot ? structuredClone(snapshot) : { id: cuid(), title: '', body: '' };
   return { kind: 'note', mode: 'copy', sourceDrawerItemId: content.sourceDrawerItemId, data };
}

/**
 * Adopt-on-open: materializes a copy's frozen `data` into a fresh, standalone {@link Note} (a NEW id, so it
 * is a real note the caller writes to `db.notes` + opens in a tab), and the board reference content that
 * re-homes the tile onto it - a live reference keyed by that new id, `lastKnown` seeded from the materialized
 * note (so it still resolves if the working row is ever reaped). The note has NO drawer parent yet
 * (`sourceDrawerItemId` undefined); a later Save links one. Deep-cloned, so the copy shares nothing.
 */
export function materializeCopyAsReference(data: Note): { note: Note; content: NoteBoardContent } {
   const note: Note = { ...structuredClone(data), id: cuid() };
   return { note, content: { kind: 'note', mode: 'reference', noteId: note.id, sourceDrawerItemId: undefined, lastKnown: note } };
}
