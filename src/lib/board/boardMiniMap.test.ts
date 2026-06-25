// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { boardContentBounds, itemCenter } from './boardMiniMap';
import type { BoardItem } from '@/lib/types/board';

/*
 * The mini-map geometry: the content bbox frames the placed items (never the connections, which carry
 * no placement), and an item's center is x+w/2, y+h/2 (where a connection line anchors).
 */

function item(over: Partial<BoardItem> & Pick<BoardItem, 'id' | 'kind'>): BoardItem {
   return { x: 0, y: 0, width: 10, height: 10, z: 0, content: {}, ...over } as BoardItem;
}

describe('boardContentBounds', () => {
   it('frames all non-connection items (origin + size from min/max extents)', () => {
      const bounds = boardContentBounds([
         item({ id: 'a', kind: 'post-it', x: 10, y: 20, width: 100, height: 50 }),
         item({ id: 'b', kind: 'pin', x: 200, y: 200, width: 20, height: 20 }),
      ]);
      expect(bounds).toEqual({ minX: 10, minY: 20, width: 210, height: 200 }); // maxX 220 - 10, maxY 220 - 20
   });

   it('excludes connections from the bbox (their zero placement must not pull the origin to 0,0)', () => {
      const bounds = boardContentBounds([
         item({ id: 'a', kind: 'post-it', x: 100, y: 100, width: 40, height: 40 }),
         item({ id: 'c', kind: 'connection', x: 0, y: 0, width: 0, height: 0 }),
      ]);
      expect(bounds).toEqual({ minX: 100, minY: 100, width: 40, height: 40 });
   });

   it('returns null when there are no placed items (an all-connection or empty board)', () => {
      expect(boardContentBounds([])).toBeNull();
      expect(boardContentBounds([item({ id: 'c', kind: 'connection' })])).toBeNull();
   });

   it('clamps a zero-extent (single point) board to a renderable minimum', () => {
      const bounds = boardContentBounds([item({ id: 'a', kind: 'pin', x: 5, y: 5, width: 0, height: 0 })]);
      expect(bounds).toEqual({ minX: 5, minY: 5, width: 1, height: 1 });
   });
});

describe('itemCenter', () => {
   it('is the item box center', () => {
      expect(itemCenter({ x: 10, y: 20, width: 100, height: 40 })).toEqual({ cx: 60, cy: 40 });
   });
});
