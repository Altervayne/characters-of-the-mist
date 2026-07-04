// -- Utils Imports --
import { applyStatusTier } from '@/lib/trackers/applyStatusTier';
import { emptyTracker } from '@/lib/trackers/emptyTracker';
import { EMBEDDED_TRACKER_SIZES } from '@/lib/board/embedDrawerItem';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';
import type { TrackerBoardContent } from '@/lib/types/board';

/*
 * Mints a fresh, board-native tracker from a tapped Challenge Card mention. The board is freeform, so
 * this is create-only: every tap spawns a new tracker (no search, no bubble-up) - `applyStatusTier`
 * only ticks the fresh status's single box. The tracker is a self-contained COPY with no drawer source.
 * Placement drops it just right of the challenge, cascading each tap so repeated mints don't stack
 * exactly. The board completes the spec with an id and z before `addItem`.
 */

const GAP = 24;
const CASCADE_STEP = 20;

/** The world rect of the challenge the mention was tapped on. */
interface ChallengeRect {
   x: number;
   y: number;
   width: number;
   height: number;
}

/** A board-item spec (sans board-assigned id/z): a `tracker` copy placed right of the challenge. */
export interface MintedTrackerSpec {
   kind: 'tracker';
   x: number;
   y: number;
   width: number;
   height: number;
   content: TrackerBoardContent;
}

/**
 * The board-item spec for a tapped status/tag mention, or `null` for a plain-text segment. `cascade`
 * (a per-tap step index) nudges each mint down-right so repeated taps don't land exactly on top of
 * each other. A status ticks its single tier box; a tag mints bare.
 */
export function trackerBoardItemForMention(segment: MentionSegment, rect: ChallengeRect, cascade = 0): MintedTrackerSpec | null {
   const x = rect.x + rect.width + GAP + cascade * CASCADE_STEP;
   const y = rect.y + cascade * CASCADE_STEP;

   if (segment.type === 'status') {
      const base = emptyTracker('STATUS');
      const data = { ...base, name: segment.name, tiers: applyStatusTier(base.tiers, segment.tier) };
      const { width, height } = EMBEDDED_TRACKER_SIZES.STATUS;
      return { kind: 'tracker', x, y, width, height, content: { kind: 'tracker', mode: 'copy', data } };
   }
   if (segment.type === 'tag') {
      const data = { ...emptyTracker('STORY_TAG'), name: segment.name };
      const { width, height } = EMBEDDED_TRACKER_SIZES.STORY_TAG;
      return { kind: 'tracker', x, y, width, height, content: { kind: 'tracker', mode: 'copy', data } };
   }
   return null;
}
