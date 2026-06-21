// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import * as repository from './boardRepository';
import { createBoardCommandEngine } from './boardCommandEngine';
import {
   bottomZ,
   createAddItemCommand,
   createDeleteItemCommand,
   createMoveItemCommand,
   createResizeItemCommand,
   createSetItemZCommand,
   createUpdateItemContentCommand,
   nextZ,
} from './boardCommands';

// -- Type Imports --
import type { BoardItemRecord } from './boardRecords';

/*
 * Tests for the board command/undo engine over the normalized repository
 * (fake-indexeddb). Each command's do/undo/redo round-trips DB state exactly, with the
 * focus on id-stability across redo; the engine's stack behaviour (cap eviction,
 * redo-clear), move/resize coalescing (injected clock), and two-engine isolation are
 * covered too.
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

// ==================
//  Per-command do / undo / redo round-trips
// ==================

describe('command round-trips', () => {
   it('add item: do puts, undo deletes, redo re-puts the same record (id-stable)', async () => {
      const board = await repository.createBoard('Board');
      const record = makeItem('item-1', board.id, 0);

      const engine = createBoardCommandEngine();
      await engine.execute(createAddItemCommand(record));
      expect(await repository.getItem('item-1')).toEqual(record);

      await engine.undo();
      expect(await repository.getItem('item-1')).toBeUndefined();

      await engine.redo();
      expect(await repository.getItem('item-1')).toEqual(record); // same id, verbatim record
   });

   it('add connection item: round-trips like any other kind', async () => {
      const board = await repository.createBoard('Board');
      const connection = makeItem('conn', board.id, 5, {
         kind: 'connection',
         content: { kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#fff' } },
      });

      const engine = createBoardCommandEngine();
      await engine.execute(createAddItemCommand(connection));
      expect(await repository.getItem('conn')).toEqual(connection);

      await engine.undo();
      expect(await repository.getItem('conn')).toBeUndefined();

      await engine.redo();
      expect(await repository.getItem('conn')).toEqual(connection);
   });

   it('move item: undo restores original x,y, redo re-applies', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 10, y: 20 }));

      const engine = createBoardCommandEngine();
      await engine.execute(createMoveItemCommand('item-1', { x: 300, y: 400 }));
      expect(await repository.getItem('item-1')).toMatchObject({ x: 300, y: 400 });

      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ x: 10, y: 20 });

      await engine.redo();
      expect(await repository.getItem('item-1')).toMatchObject({ x: 300, y: 400 });
   });

   it('resize item: undo restores dimensions, and x,y on a repositioning corner resize', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 10, y: 20, width: 100, height: 100 }));

      const engine = createBoardCommandEngine();
      await engine.execute(createResizeItemCommand('item-1', { width: 250, height: 180, x: 40, y: 60 }));
      expect(await repository.getItem('item-1')).toMatchObject({ width: 250, height: 180, x: 40, y: 60 });

      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ width: 100, height: 100, x: 10, y: 20 });

      await engine.redo();
      expect(await repository.getItem('item-1')).toMatchObject({ width: 250, height: 180, x: 40, y: 60 });
   });

   it('resize item: a size-only resize leaves x,y untouched', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 10, y: 20, width: 100, height: 100 }));

      const engine = createBoardCommandEngine();
      await engine.execute(createResizeItemCommand('item-1', { width: 250, height: 180 }));
      expect(await repository.getItem('item-1')).toMatchObject({ width: 250, height: 180, x: 10, y: 20 });

      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ width: 100, height: 100, x: 10, y: 20 });
   });

   it('set z: captures and restores the previous z', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 3));

      const engine = createBoardCommandEngine();
      await engine.execute(createSetItemZCommand('item-1', 9));
      expect((await repository.getItem('item-1'))?.z).toBe(9);

      await engine.undo();
      expect((await repository.getItem('item-1'))?.z).toBe(3);

      await engine.redo();
      expect((await repository.getItem('item-1'))?.z).toBe(9);
   });

   it('update content: undo restores prior content, covering a connection restyle', async () => {
      const board = await repository.createBoard('Board');
      const original = { kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#fff' } } as const;
      await repository.addItem(makeItem('conn', board.id, 0, { kind: 'connection', content: original }));
      const restyled = { kind: 'connection', from: 'a', to: 'b', style: { width: 6, color: '#f00' } } as const;

      const engine = createBoardCommandEngine();
      await engine.execute(createUpdateItemContentCommand('conn', restyled));
      expect((await repository.getItem('conn'))?.content).toEqual(restyled);

      await engine.undo();
      expect((await repository.getItem('conn'))?.content).toEqual(original);

      await engine.redo();
      expect((await repository.getItem('conn'))?.content).toEqual(restyled);
   });

   it('delete item: undo re-adds the captured record verbatim (id-stable), redo deletes again', async () => {
      const board = await repository.createBoard('Board');
      const record = makeItem('item-1', board.id, 7, { x: 5, y: 6, content: { kind: 'post-it', text: 'keep me' } });
      await repository.addItem(record);

      const engine = createBoardCommandEngine();
      await engine.execute(createDeleteItemCommand('item-1'));
      expect(await repository.getItem('item-1')).toBeUndefined();

      await engine.undo();
      expect(await repository.getItem('item-1')).toEqual(record); // byte-for-byte, same id

      await engine.redo();
      expect(await repository.getItem('item-1')).toBeUndefined();
   });
});

// ==================
//  Missing-target errors
// ==================

describe('missing targets', () => {
   it('throws BoardNotFoundError when a target item is absent', async () => {
      const engine = createBoardCommandEngine();
      await expect(engine.execute(createMoveItemCommand('nope', { x: 1, y: 1 }))).rejects.toThrow(/not found/i);
      await expect(engine.execute(createResizeItemCommand('nope', { width: 1, height: 1 }))).rejects.toThrow(/not found/i);
      await expect(engine.execute(createSetItemZCommand('nope', 1))).rejects.toThrow(/not found/i);
      await expect(engine.execute(createDeleteItemCommand('nope'))).rejects.toThrow(/not found/i);
   });
});

// ==================
//  z helpers
// ==================

describe('z helpers', () => {
   it('nextZ/bottomZ bracket the current z range, and default to 0 on an empty board', async () => {
      const board = await repository.createBoard('Board');
      expect(await nextZ(board.id)).toBe(0);
      expect(await bottomZ(board.id)).toBe(0);

      await repository.bulkPutItems([
         makeItem('a', board.id, 2),
         makeItem('b', board.id, 5),
         makeItem('c', board.id, -1),
      ]);
      expect(await nextZ(board.id)).toBe(6); // max(5) + 1
      expect(await bottomZ(board.id)).toBe(-2); // min(-1) - 1
   });
});

// ==================
//  Engine stack behaviour
// ==================

describe('engine stack', () => {
   it('caps the undo stack, dropping the oldest entry', async () => {
      const board = await repository.createBoard('Board');
      const engine = createBoardCommandEngine({ undoLimit: 2 });
      await engine.execute(createAddItemCommand(makeItem('first', board.id, 0)));
      await engine.execute(createAddItemCommand(makeItem('second', board.id, 1)));
      await engine.execute(createAddItemCommand(makeItem('third', board.id, 2)));

      // Only the two most recent are undoable; the first is evicted.
      await engine.undo();
      await engine.undo();
      expect(engine.canUndo()).toBe(false);

      // The first item remains because its command was dropped from the stack.
      expect((await repository.listItems(board.id)).map((item) => item.id)).toEqual(['first']);
   });

   it('clears the redo stack when a new command is executed', async () => {
      const board = await repository.createBoard('Board');
      const engine = createBoardCommandEngine();
      await engine.execute(createAddItemCommand(makeItem('a', board.id, 0)));
      await engine.undo();
      expect(engine.canRedo()).toBe(true);

      await engine.execute(createAddItemCommand(makeItem('b', board.id, 1)));
      expect(engine.canRedo()).toBe(false);
   });

   it('undo/redo are no-ops on empty stacks', async () => {
      const engine = createBoardCommandEngine();
      await expect(engine.undo()).resolves.toBeUndefined();
      await expect(engine.redo()).resolves.toBeUndefined();
      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(false);
   });

   it('notifies subscribers and supports clear()', async () => {
      const board = await repository.createBoard('Board');
      const engine = createBoardCommandEngine();
      let notifications = 0;
      const unsubscribe = engine.subscribe(() => { notifications += 1; });

      await engine.execute(createAddItemCommand(makeItem('a', board.id, 0)));
      expect(notifications).toBeGreaterThan(0);

      engine.clear();
      expect(engine.canUndo()).toBe(false);
      expect(engine.canRedo()).toBe(false);

      unsubscribe();
      const countAfterUnsubscribe = notifications;
      await engine.execute(createAddItemCommand(makeItem('b', board.id, 1)));
      expect(notifications).toBe(countAfterUnsubscribe); // no longer notified
   });
});

// ==================
//  Failed-command resilience
// ==================

describe('failed commands', () => {
   it('rethrows a failed undo and keeps the entry on the undo stack', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 0, y: 0 }));

      const engine = createBoardCommandEngine();
      await engine.execute(createMoveItemCommand('item-1', { x: 50, y: 50 }));

      // Delete out from under the command so its undo (an updateItem) fails.
      await repository.deleteItem('item-1');
      await expect(engine.undo()).rejects.toThrow(/not found/i);

      // The stack is intact: the entry was re-pushed, nothing leaked to redo.
      expect(engine.canUndo()).toBe(true);
      expect(engine.canRedo()).toBe(false);

      // Restore the item and the same undo now succeeds.
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 50, y: 50 }));
      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ x: 0, y: 0 });
   });

   it('rethrows a failed redo and keeps the command on the redo stack', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 0, y: 0 }));

      const engine = createBoardCommandEngine();
      await engine.execute(createMoveItemCommand('item-1', { x: 50, y: 50 }));
      await engine.undo();

      // Delete out from under the command so its redo (an updateItem) fails.
      await repository.deleteItem('item-1');
      await expect(engine.redo()).rejects.toThrow(/not found/i);

      // The redo entry survived; undo stack stayed empty.
      expect(engine.canRedo()).toBe(true);
      expect(engine.canUndo()).toBe(false);
   });
});

// ==================
//  Coalescing
// ==================

describe('move coalescing', () => {
   it('collapses a drag burst within the window into one undo step back to the pre-burst position', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 0, y: 0 }));

      let clock = 1000;
      const engine = createBoardCommandEngine({ now: () => clock });

      await engine.execute(createMoveItemCommand('item-1', { x: 10, y: 10 }));
      clock += 100; // within 600ms window
      await engine.execute(createMoveItemCommand('item-1', { x: 20, y: 20 }));
      clock += 100;
      await engine.execute(createMoveItemCommand('item-1', { x: 30, y: 30 }));

      expect(await repository.getItem('item-1')).toMatchObject({ x: 30, y: 30 }); // latest "after"

      // A single undo returns all the way to the pre-burst position.
      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ x: 0, y: 0 });
      expect(engine.canUndo()).toBe(false); // the burst was one entry
   });

   it('does not coalesce when the window has elapsed', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { x: 0, y: 0 }));

      let clock = 0;
      const engine = createBoardCommandEngine({ now: () => clock });

      await engine.execute(createMoveItemCommand('item-1', { x: 10, y: 10 }));
      clock += 700; // outside 600ms window
      await engine.execute(createMoveItemCommand('item-1', { x: 20, y: 20 }));

      // Two separate undo steps.
      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ x: 10, y: 10 }); // back to first "after"
      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ x: 0, y: 0 });
   });

   it('does not coalesce moves of different items', async () => {
      const board = await repository.createBoard('Board');
      await repository.bulkPutItems([makeItem('a', board.id, 0), makeItem('b', board.id, 1)]);

      let clock = 0;
      const engine = createBoardCommandEngine({ now: () => clock });
      await engine.execute(createMoveItemCommand('a', { x: 5, y: 5 }));
      clock += 100;
      await engine.execute(createMoveItemCommand('b', { x: 9, y: 9 })); // different id -> separate entry

      await engine.undo(); // undoes b only
      await engine.undo(); // undoes a
      expect(engine.canUndo()).toBe(false);
   });

   it('coalesces a resize burst, keeping the original dimensions for undo', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeItem('item-1', board.id, 0, { width: 100, height: 100 }));

      let clock = 0;
      const engine = createBoardCommandEngine({ now: () => clock });
      await engine.execute(createResizeItemCommand('item-1', { width: 120, height: 120 }));
      clock += 100;
      await engine.execute(createResizeItemCommand('item-1', { width: 200, height: 160 }));

      expect(await repository.getItem('item-1')).toMatchObject({ width: 200, height: 160 });

      await engine.undo();
      expect(await repository.getItem('item-1')).toMatchObject({ width: 100, height: 100 });
      expect(engine.canUndo()).toBe(false);
   });
});

// ==================
//  Per-instance isolation
// ==================

describe('per-instance isolation', () => {
   it('two engines over the same table do not interfere (commands are id-scoped)', async () => {
      const boardA = await repository.createBoard('A');
      const boardB = await repository.createBoard('B');
      await repository.addItem(makeItem('a-item', boardA.id, 0, { x: 0, y: 0 }));
      await repository.addItem(makeItem('b-item', boardB.id, 0, { x: 0, y: 0 }));

      const engineA = createBoardCommandEngine();
      const engineB = createBoardCommandEngine();

      await engineA.execute(createMoveItemCommand('a-item', { x: 100, y: 100 }));
      await engineB.execute(createMoveItemCommand('b-item', { x: 200, y: 200 }));

      // Undoing on A reverts only A's item; B's stays put and B can still undo it.
      await engineA.undo();
      expect(await repository.getItem('a-item')).toMatchObject({ x: 0, y: 0 });
      expect(await repository.getItem('b-item')).toMatchObject({ x: 200, y: 200 });
      expect(engineA.canUndo()).toBe(false);
      expect(engineB.canUndo()).toBe(true);

      await engineB.undo();
      expect(await repository.getItem('b-item')).toMatchObject({ x: 0, y: 0 });
   });
});
