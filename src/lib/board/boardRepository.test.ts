// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import * as repository from './boardRepository';
import { BOARD_SCHEMA_VERSION } from './boardRecords';

// -- Type Imports --
import type { BoardItemRecord } from './boardRecords';

/*
 * Unit tests for the board repository against fake-indexeddb. Covers board CRUD,
 * item CRUD + bulk, z-ordered listing, cascade delete, the aggregate read, and the
 * reset-app clear. Content is opaque to the repo, so the fixtures use the minimal
 * per-kind payloads.
 */

/** Builds a flat board-item record with sane placement defaults. */
function makeItem(id: string, boardId: string, z: number, overrides: Partial<BoardItemRecord> = {}): BoardItemRecord {
   return {
      id,
      boardId,
      kind: 'post-it',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      z,
      content: { kind: 'post-it', text: id },
      ...overrides,
   };
}

beforeEach(async () => {
   await drawerDatabase.boards.clear();
   await drawerDatabase.boardItems.clear();
});

describe('board CRUD', () => {
   it('creates a board with a fresh id, default viewport, and schema version', async () => {
      const board = await repository.createBoard('My Board');

      expect(board).toMatchObject({
         name: 'My Board',
         viewport: { x: 0, y: 0, zoom: 1 },
         schemaVersion: BOARD_SCHEMA_VERSION,
      });
      expect(typeof board.id).toBe('string');
      expect(typeof board.updatedAt).toBe('number');
      expect((await repository.getBoard(board.id))?.name).toBe('My Board');
   });

   it('lists boards most-recently-updated first', async () => {
      const first = await repository.createBoard('First');
      await new Promise((resolve) => setTimeout(resolve, 2));
      const second = await repository.createBoard('Second');

      const ids = (await repository.listBoards()).map((b) => b.id);
      expect(ids).toEqual([second.id, first.id]);
   });

   it('renames a board and refreshes updatedAt', async () => {
      const board = await repository.createBoard('Old');
      await new Promise((resolve) => setTimeout(resolve, 2));

      await repository.renameBoard(board.id, 'New');

      const reloaded = await repository.getBoard(board.id);
      expect(reloaded?.name).toBe('New');
      expect(reloaded!.updatedAt).toBeGreaterThanOrEqual(board.updatedAt);
   });

   it('rejects renaming a missing board', async () => {
      await expect(repository.renameBoard('nope', 'X')).rejects.toThrow();
   });

   it('upserts a board via saveBoard, refreshing updatedAt', async () => {
      const board = await repository.createBoard('Board');
      await new Promise((resolve) => setTimeout(resolve, 2));

      const saved = await repository.saveBoard({ ...board, viewport: { x: 50, y: 60, zoom: 2 } });

      expect(saved.updatedAt).toBeGreaterThanOrEqual(board.updatedAt);
      expect((await repository.getBoard(board.id))?.viewport).toEqual({ x: 50, y: 60, zoom: 2 });
   });
});

describe('board item CRUD', () => {
   it('adds, gets, updates, and deletes an item', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0));

      expect((await repository.getItem('item-1'))?.content).toEqual({ kind: 'post-it', text: 'item-1' });

      await repository.updateItem('item-1', { x: 200, content: { kind: 'post-it', text: 'edited' } });
      const updated = await repository.getItem('item-1');
      expect(updated?.x).toBe(200);
      expect(updated?.content).toEqual({ kind: 'post-it', text: 'edited' });

      await repository.deleteItem('item-1');
      expect(await repository.getItem('item-1')).toBeUndefined();
   });

   it('rejects updating a missing item', async () => {
      await expect(repository.updateItem('nope', { x: 1 })).rejects.toThrow();
   });

   it('lists a board\'s items in z-order, scoped to that board', async () => {
      const a = await repository.createBoard('A');
      const b = await repository.createBoard('B');
      await repository.addItem(makeItem('a-2', a.id, 2));
      await repository.addItem(makeItem('a-0', a.id, 0));
      await repository.addItem(makeItem('a-1', a.id, 1));
      await repository.addItem(makeItem('b-0', b.id, 0));

      const ids = (await repository.listItems(a.id)).map((i) => i.id);
      expect(ids).toEqual(['a-0', 'a-1', 'a-2']); // z-ordered, board B excluded
   });

   it('bulk-puts and bulk-deletes items atomically', async () => {
      const board = await repository.createBoard('Board');
      await repository.bulkPutItems([
         makeItem('i1', board.id, 0),
         makeItem('i2', board.id, 1),
         makeItem('i3', board.id, 2),
      ]);
      expect(await repository.listItems(board.id)).toHaveLength(3);

      await repository.bulkDeleteItems(['i1', 'i3', 'missing']);
      expect((await repository.listItems(board.id)).map((i) => i.id)).toEqual(['i2']);
   });

   it('persists a connection item with non-spatial zeros and opaque content', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(
         makeItem('conn', board.id, 5, {
            kind: 'connection',
            content: { kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#fff' } },
         }),
      );

      const item = await repository.getItem('conn');
      expect(item?.kind).toBe('connection');
      expect(item?.content).toEqual({ kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#fff' } });
   });

   it('listAllBoardItems returns every item across all boards (for asset GC)', async () => {
      const a = await repository.createBoard('A');
      const b = await repository.createBoard('B');
      await repository.bulkPutItems([makeItem('a1', a.id, 0), makeItem('a2', a.id, 1)]);
      await repository.addItem(makeItem('b1', b.id, 0));

      const all = (await repository.listAllBoardItems()).map((i) => i.id).sort();
      expect(all).toEqual(['a1', 'a2', 'b1']);
   });
});

describe('deleteBoard (cascade)', () => {
   it('deletes the board and all its items, leaving other boards untouched', async () => {
      const target = await repository.createBoard('Target');
      const other = await repository.createBoard('Other');
      await repository.bulkPutItems([makeItem('t1', target.id, 0), makeItem('t2', target.id, 1)]);
      await repository.addItem(makeItem('o1', other.id, 0));

      await repository.deleteBoard(target.id);

      expect(await repository.getBoard(target.id)).toBeUndefined();
      expect(await repository.listItems(target.id)).toEqual([]); // no orphan items
      // The other board and its items survive.
      expect(await repository.getBoard(other.id)).toBeDefined();
      expect((await repository.listItems(other.id)).map((i) => i.id)).toEqual(['o1']);
   });

   it('is a no-op for a missing board', async () => {
      await expect(repository.deleteBoard('nope')).resolves.toBeUndefined();
   });
});

describe('loadBoard (aggregate read)', () => {
   it('assembles the board with z-ordered items', async () => {
      const board = await repository.createBoard('Board');
      await repository.saveBoard({ ...board, viewport: { x: 10, y: 20, zoom: 1.5 } });
      await repository.addItem(makeItem('i1', board.id, 1));
      await repository.addItem(makeItem('i0', board.id, 0, { kind: 'image', content: { kind: 'image', assetId: 'hash', fit: 'cover' } }));

      const aggregate = await repository.loadBoard(board.id);

      expect(aggregate).toBeDefined();
      expect(aggregate!.name).toBe('Board');
      expect(aggregate!.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
      expect(aggregate!.items.map((i) => i.id)).toEqual(['i0', 'i1']); // z-ordered
      expect(aggregate!.items[0]).toMatchObject({ kind: 'image', content: { kind: 'image', assetId: 'hash', fit: 'cover' } });
   });

   it('returns undefined for a missing board', async () => {
      expect(await repository.loadBoard('nope')).toBeUndefined();
   });
});

describe('clearAllBoards', () => {
   it('clears every board and item row', async () => {
      const board = await repository.createBoard('Board');
      await repository.bulkPutItems([makeItem('i1', board.id, 0), makeItem('i2', board.id, 1)]);

      await repository.clearAllBoards();

      expect(await drawerDatabase.boards.count()).toBe(0);
      expect(await drawerDatabase.boardItems.count()).toBe(0);
   });
});
