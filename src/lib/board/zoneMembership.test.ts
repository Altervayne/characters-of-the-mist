// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { zoneContaining, zoneContentMinSize } from './zoneMembership';
import { MIN_ITEM_SIZE } from './boardResize';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * Tests for geometric zone membership: a placed item belongs to the zone whose rectangle holds its
 * CENTER, the topmost (highest z) on overlap, never itself, and never a non-zone item. Plus the
 * resize floor: a zone can't shrink below the extent of its members.
 */

function zone(id: string, x: number, y: number, width: number, height: number, z: number): BoardItem {
   return { id, kind: 'zone', x, y, width, height, z, content: { kind: 'zone', collapsed: false } };
}

/** A small item placed so its CENTER lands at (cx, cy). */
function at(id: string, cx: number, cy: number): { id: string; x: number; y: number; width: number; height: number } {
   return { id, x: cx - 10, y: cy - 10, width: 20, height: 20 };
}

describe('zoneContaining', () => {
   const zoneA = zone('A', 0, 0, 200, 200, 0);

   it('returns the zone whose rectangle contains the item center', () => {
      expect(zoneContaining(at('item', 100, 100), [zoneA])).toBe('A');
   });

   it('returns null when the center is outside every zone', () => {
      expect(zoneContaining(at('item', 300, 300), [zoneA])).toBeNull();
   });

   it('picks the topmost (highest z) zone when several overlap the center', () => {
      const under = zone('under', 0, 0, 200, 200, 1);
      const over = zone('over', 50, 50, 200, 200, 5);
      // Center (100,100) is inside both; the higher-z 'over' wins.
      expect(zoneContaining(at('item', 100, 100), [under, over])).toBe('over');
   });

   it('treats the rectangle edge as inside (inclusive bounds)', () => {
      // Center exactly on the right/bottom edge of zoneA.
      expect(zoneContaining(at('item', 200, 200), [zoneA])).toBe('A');
   });

   it('never reports a zone as a member of itself', () => {
      expect(zoneContaining({ id: 'A', x: 0, y: 0, width: 200, height: 200 }, [zoneA])).toBeNull();
   });

   it('ignores non-zone items as candidates', () => {
      const notAZone: BoardItem = { id: 'P', kind: 'post-it', x: 0, y: 0, width: 200, height: 200, z: 9, content: { kind: 'post-it', text: '' } };
      expect(zoneContaining(at('item', 100, 100), [notAZone])).toBeNull();
   });
});

describe('zoneContentMinSize', () => {
   const zoneAt = { x: 100, y: 100 };
   function member(id: string, x: number, y: number, width: number, height: number): BoardItem {
      return { id, kind: 'post-it', x, y, width, height, z: 0, zoneId: 'Z', content: { kind: 'post-it', text: id } };
   }

   it('floors at MIN_ITEM_SIZE on both axes when the zone has no members', () => {
      expect(zoneContentMinSize(zoneAt, [])).toEqual({ width: MIN_ITEM_SIZE, height: MIN_ITEM_SIZE });
   });

   it('extends to the farthest member right/bottom edge (relative to the zone origin)', () => {
      // A member ending at x=420,y=360 vs the zone origin 100,100 -> needs 320x260.
      const result = zoneContentMinSize(zoneAt, [member('m', 300, 250, 120, 110)]);
      expect(result).toEqual({ width: 320, height: 260 });
   });

   it('takes the max extent across several members', () => {
      const result = zoneContentMinSize(zoneAt, [member('a', 150, 150, 50, 300), member('b', 500, 120, 60, 40)]);
      // widest right edge: b at 560 -> 460; tallest bottom: a at 450 -> 350.
      expect(result).toEqual({ width: 460, height: 350 });
   });

   it('floors a tiny member at MIN_ITEM_SIZE (never below the minimum)', () => {
      expect(zoneContentMinSize(zoneAt, [member('m', 100, 100, 10, 10)])).toEqual({ width: MIN_ITEM_SIZE, height: MIN_ITEM_SIZE });
   });
});
