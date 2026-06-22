// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { connectionEndpoints, connectionsReferencing } from './boardConnections';
import { createBoard } from './boardRepository';
import { createBoardStore } from '@/lib/stores/boardStore';
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * Tests for connection geometry (box-edge intersection across orientations) and the
 * cascade lookup (which connections reference a given item).
 */

describe('connectionEndpoints', () => {
   it('clips a horizontal connection to the facing edges', () => {
      const from = { x: 0, y: 0, width: 100, height: 100 }; // centre (50,50)
      const to = { x: 200, y: 0, width: 100, height: 100 }; // centre (250,50)

      const { from: a, to: b } = connectionEndpoints(from, to);

      expect(a).toEqual({ x: 100, y: 50 }); // right edge of `from`
      expect(b).toEqual({ x: 200, y: 50 }); // left edge of `to`
   });

   it('clips a vertical connection to the facing edges', () => {
      const from = { x: 0, y: 0, width: 100, height: 100 };
      const to = { x: 0, y: 200, width: 100, height: 100 };

      const { from: a, to: b } = connectionEndpoints(from, to);

      expect(a).toEqual({ x: 50, y: 100 }); // bottom edge of `from`
      expect(b).toEqual({ x: 50, y: 200 }); // top edge of `to`
   });

   it('clips a 45-degree diagonal to the corners', () => {
      const from = { x: 0, y: 0, width: 100, height: 100 }; // centre (50,50)
      const to = { x: 200, y: 200, width: 100, height: 100 }; // centre (250,250)

      const { from: a, to: b } = connectionEndpoints(from, to);

      expect(a).toEqual({ x: 100, y: 100 }); // bottom-right corner of `from`
      expect(b).toEqual({ x: 200, y: 200 }); // top-left corner of `to`
   });

   it('treats a zero-size target as a free endpoint at its centre (drag preview)', () => {
      const from = { x: 0, y: 0, width: 100, height: 100 };
      const cursor = { x: 300, y: 50, width: 0, height: 0 };

      const { from: a, to: b } = connectionEndpoints(from, cursor);

      expect(a).toEqual({ x: 100, y: 50 }); // still clipped to `from`'s edge
      expect(b).toEqual({ x: 300, y: 50 }); // the cursor itself
   });
});

/** Minimal board-item factory for the cascade lookup. */
function item(id: string, content: BoardItem['content']): BoardItem {
   return { id, kind: content.kind, x: 0, y: 0, width: 0, height: 0, z: 0, content };
}

describe('connectionsReferencing', () => {
   it('finds connections referencing an item as `from` or `to`, ignoring unrelated ones', () => {
      const items: Record<string, BoardItem> = {
         a: item('a', { kind: 'post-it', text: '' }),
         b: item('b', { kind: 'post-it', text: '' }),
         c: item('c', { kind: 'post-it', text: '' }),
         'conn-ab': item('conn-ab', { kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#fff' } }),
         'conn-ca': item('conn-ca', { kind: 'connection', from: 'c', to: 'a', style: { width: 2, color: '#fff' } }),
         'conn-bc': item('conn-bc', { kind: 'connection', from: 'b', to: 'c', style: { width: 2, color: '#fff' } }),
      };

      expect(connectionsReferencing(items, 'a').sort()).toEqual(['conn-ab', 'conn-ca']);
      expect(connectionsReferencing(items, 'c').sort()).toEqual(['conn-bc', 'conn-ca'].sort());
      expect(connectionsReferencing(items, 'missing')).toEqual([]);
   });
});

describe('cascade delete (no orphan connections)', () => {
   beforeEach(async () => {
      await drawerDatabase.boards.clear();
      await drawerDatabase.boardItems.clear();
   });

   it('removing an endpoint item also removes its connections, leaving the other item', async () => {
      const board = await createBoard('Test');
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);
      const add = store.getState().actions.addItem;
      await add({ id: 'a', kind: 'post-it', x: 0, y: 0, width: 100, height: 100, z: 0, content: { kind: 'post-it', text: '' } });
      await add({ id: 'b', kind: 'post-it', x: 200, y: 0, width: 100, height: 100, z: 1, content: { kind: 'post-it', text: '' } });
      await add({ id: 'conn', kind: 'connection', x: 0, y: 0, width: 0, height: 0, z: 2, content: { kind: 'connection', from: 'a', to: 'b', style: { width: 3, color: '#3b82f6' } } });

      // The cascade BoardView performs: delete connections referencing 'a', then 'a'.
      const toDelete = connectionsReferencing(store.getState().items, 'a');
      expect(toDelete).toEqual(['conn']);
      for (const id of toDelete) await store.getState().actions.deleteItem(id);
      await store.getState().actions.deleteItem('a');

      expect(Object.keys(store.getState().items).sort()).toEqual(['b']); // no orphan connection
   });
});
