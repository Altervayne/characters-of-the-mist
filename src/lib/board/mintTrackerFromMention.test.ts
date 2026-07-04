// -- Testing Imports --
import { describe, it, expect } from 'vitest';

// -- Utils Imports --
import { trackerBoardItemForMention } from './mintTrackerFromMention';
import { EMBEDDED_TRACKER_SIZES } from '@/lib/board/embedDrawerItem';

// -- Type Imports --
import type { MentionSegment } from '@/lib/challenge/parseMentions';

const RECT = { x: 100, y: 50, width: 250, height: 600 };
const GAP = 24;

describe('trackerBoardItemForMention', () => {
   it('mints a status tracker right of the challenge with a single ticked box at its tier', () => {
      const segment: MentionSegment = { type: 'status', name: 'sickened', tier: 2, raw: 'sickened-2' };
      const spec = trackerBoardItemForMention(segment, RECT);

      expect(spec).not.toBeNull();
      expect(spec!.kind).toBe('tracker');
      expect(spec!.width).toBe(EMBEDDED_TRACKER_SIZES.STATUS.width);
      expect(spec!.height).toBe(EMBEDDED_TRACKER_SIZES.STATUS.height);
      expect(spec!.x).toBe(RECT.x + RECT.width + GAP);
      expect(spec!.y).toBe(RECT.y);

      expect(spec!.content.mode).toBe('copy');
      const data = spec!.content.mode === 'copy' ? (spec!.content.data as { name: string; tiers: boolean[] }) : null;
      expect(data!.name).toBe('sickened');
      expect(data!.tiers).toEqual([false, true, false, false, false, false]);
   });

   it('mints a story-tag tracker at the STORY_TAG size', () => {
      const segment: MentionSegment = { type: 'tag', name: 'Concerned', raw: 'Concerned' };
      const spec = trackerBoardItemForMention(segment, RECT);

      expect(spec).not.toBeNull();
      expect(spec!.width).toBe(EMBEDDED_TRACKER_SIZES.STORY_TAG.width);
      expect(spec!.height).toBe(EMBEDDED_TRACKER_SIZES.STORY_TAG.height);
      const data = spec!.content.mode === 'copy' ? (spec!.content.data as { name: string }) : null;
      expect(data!.name).toBe('Concerned');
   });

   it('mints a self-contained copy with no drawer source', () => {
      const segment: MentionSegment = { type: 'status', name: 'burned', tier: 3, raw: 'burned-3' };
      const spec = trackerBoardItemForMention(segment, RECT);

      expect(spec!.content.mode).toBe('copy');
      expect(spec!.content).not.toHaveProperty('sourceDrawerItemId');
   });

   it('cascades repeated mints down-right so they do not perfectly overlap', () => {
      const segment: MentionSegment = { type: 'status', name: 'sickened', tier: 2, raw: 'sickened-2' };
      const first = trackerBoardItemForMention(segment, RECT, 0);
      const second = trackerBoardItemForMention(segment, RECT, 1);

      expect(second!.x).toBeGreaterThan(first!.x);
      expect(second!.y).toBeGreaterThan(first!.y);
   });

   it('returns null for a plain-text segment', () => {
      const segment: MentionSegment = { type: 'text', text: 'no mention here' };
      expect(trackerBoardItemForMention(segment, RECT)).toBeNull();
   });
});
