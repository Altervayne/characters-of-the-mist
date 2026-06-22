// -- Type Imports --
import type { CardBoardContent, TrackerBoardContent } from '@/lib/types/board';

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
