// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import * as repository from '@/lib/board/boardRepository';
import { createBoardStore } from './boardStore';
import { useAppGeneralStateStore } from './appGeneralStateStore';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';
import type { BoardItemRecord } from '@/lib/board/boardRecords';

/*
 * Tests for the in-memory board store factory against fake-indexeddb. They assert the
 * optimistic-apply + command-persist + resync loop (memory AND repo agree), that undo
 * resyncs the view, that bring-to-front / send-to-back z math is correct, that
 * canUndo/canRedo track each instance's engine reactively, that the viewport persists
 * (debounced) without entering undo, that a failed command reverts the in-memory map,
 * and that two stores share no undo history.
 */

/** Builds an assembled board item (no `boardId`; the store adds it on persist). */
function makeItem(id: string, z: number, overrides: Partial<BoardItem> = {}): BoardItem {
   return {
      id,
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

/** Builds a flat record for seeding the repo directly (for hydrate fixtures). */
function makeRecord(id: string, boardId: string, z: number, overrides: Partial<BoardItemRecord> = {}): BoardItemRecord {
   return { ...makeItem(id, z), boardId, ...overrides };
}

/** Polls `check` until it returns a value, or throws after `timeoutMs` (robust to debounce timing under load). */
async function waitFor<T>(check: () => Promise<T | undefined> | T | undefined, timeoutMs = 1000): Promise<T> {
   const deadline = Date.now() + timeoutMs;
   for (;;) {
      const value = await check();
      if (value !== undefined) return value;
      if (Date.now() > deadline) throw new Error('waitFor timed out');
      await new Promise((resolve) => setTimeout(resolve, 5));
   }
}

beforeEach(async () => {
   await drawerDatabase.boards.clear();
   await drawerDatabase.boardItems.clear();
   // Start from a non-board last-modified so the assertions below prove a flip.
   useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
});

// ==================
//  Hydration
// ==================

describe('hydrate', () => {
   it('loads name, viewport, and items, and clears undo history', async () => {
      const board = await repository.createBoard('My Board');
      await repository.saveBoard({ ...board, viewport: { x: 10, y: 20, zoom: 1.5 } });
      await repository.bulkPutItems([makeRecord('a', board.id, 0), makeRecord('b', board.id, 1)]);

      const store = createBoardStore();
      // A leftover undo entry from a previous board must not survive a (re)hydrate.
      await store.getState().actions.addItem(makeItem('stale', 0));
      const orphanBoard = await repository.createBoard('Orphan');
      await store.getState().actions.hydrate(orphanBoard.id); // switch boards
      expect(store.getState().canUndo).toBe(false);

      await store.getState().actions.hydrate(board.id);
      expect(store.getState().name).toBe('My Board');
      expect(store.getState().viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
      expect(Object.keys(store.getState().items).sort()).toEqual(['a', 'b']);
      expect(store.getState().canUndo).toBe(false);
   });

   it('tolerates a missing board with an error state', async () => {
      const store = createBoardStore();
      await store.getState().actions.hydrate('nope');
      expect(store.getState().error).toMatch(/not found/i);
      expect(store.getState().boardId).toBeNull();
      expect(store.getState().items).toEqual({});
   });
});

// ==================
//  Mutating actions: optimistic apply + persist + undo resync
// ==================

describe('mutating actions', () => {
   it('addItem applies optimistically, persists via the command, and undo reverts both', async () => {
      const board = await repository.createBoard('Board');
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      await store.getState().actions.addItem(makeItem('item-1', 0, { x: 5 }));
      expect(store.getState().items['item-1']).toMatchObject({ x: 5 }); // optimistic in memory
      expect(await repository.getItem('item-1')).toMatchObject({ x: 5, boardId: board.id }); // persisted

      await store.getState().actions.undo();
      expect(store.getState().items['item-1']).toBeUndefined(); // resynced view
      expect(await repository.getItem('item-1')).toBeUndefined();
   });

   it('moveItem applies optimistically, persists, and undo restores the prior position', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeRecord('item-1', board.id, 0, { x: 0, y: 0 }));
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      await store.getState().actions.moveItem('item-1', { x: 300, y: 400 });
      expect(store.getState().items['item-1']).toMatchObject({ x: 300, y: 400 });
      expect(await repository.getItem('item-1')).toMatchObject({ x: 300, y: 400 });

      await store.getState().actions.undo();
      expect(store.getState().items['item-1']).toMatchObject({ x: 0, y: 0 });
      expect(await repository.getItem('item-1')).toMatchObject({ x: 0, y: 0 });
   });

   it('resizeItem persists dimensions (and x/y on a corner resize), undo restores', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeRecord('item-1', board.id, 0, { x: 10, y: 20, width: 100, height: 100 }));
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      await store.getState().actions.resizeItem('item-1', { width: 250, height: 180, x: 40, y: 60 });
      expect(store.getState().items['item-1']).toMatchObject({ width: 250, height: 180, x: 40, y: 60 });
      expect(await repository.getItem('item-1')).toMatchObject({ width: 250, height: 180, x: 40, y: 60 });

      await store.getState().actions.undo();
      expect(store.getState().items['item-1']).toMatchObject({ width: 100, height: 100, x: 10, y: 20 });
   });

   it('updateItemContent persists new content, undo restores the old content', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeRecord('item-1', board.id, 0, { content: { kind: 'post-it', text: 'old' } }));
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      await store.getState().actions.updateItemContent('item-1', { kind: 'post-it', text: 'new' });
      expect(store.getState().items['item-1'].content).toEqual({ kind: 'post-it', text: 'new' });
      expect((await repository.getItem('item-1'))?.content).toEqual({ kind: 'post-it', text: 'new' });

      await store.getState().actions.undo();
      expect(store.getState().items['item-1'].content).toEqual({ kind: 'post-it', text: 'old' });
   });

   it('deleteItem removes optimistically and persists, undo restores the record', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeRecord('item-1', board.id, 0, { x: 7 }));
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      await store.getState().actions.deleteItem('item-1');
      expect(store.getState().items['item-1']).toBeUndefined();
      expect(await repository.getItem('item-1')).toBeUndefined();

      await store.getState().actions.undo();
      expect(store.getState().items['item-1']).toMatchObject({ x: 7 });
      expect(await repository.getItem('item-1')).toMatchObject({ x: 7 });
   });
});

// ==================
//  z ordering
// ==================

describe('bringToFront / sendToBack', () => {
   it('computes max(z)+1 and min(z)-1 over the live items', async () => {
      const board = await repository.createBoard('Board');
      await repository.bulkPutItems([
         makeRecord('a', board.id, 0),
         makeRecord('b', board.id, 1),
         makeRecord('c', board.id, 2),
      ]);
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      await store.getState().actions.bringToFront('a');
      expect(store.getState().items['a'].z).toBe(3); // max(0,1,2) + 1
      expect((await repository.getItem('a'))?.z).toBe(3);

      await store.getState().actions.sendToBack('a');
      expect(store.getState().items['a'].z).toBe(0); // min(1,2,3) - 1
      expect((await repository.getItem('a'))?.z).toBe(0);
   });
});

// ==================
//  Reactive canUndo / canRedo
// ==================

describe('canUndo / canRedo', () => {
   it('track the engine across execute / undo / redo', async () => {
      const board = await repository.createBoard('Board');
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);
      expect(store.getState().canUndo).toBe(false);
      expect(store.getState().canRedo).toBe(false);

      await store.getState().actions.addItem(makeItem('item-1', 0));
      expect(store.getState().canUndo).toBe(true);
      expect(store.getState().canRedo).toBe(false);

      await store.getState().actions.undo();
      expect(store.getState().canUndo).toBe(false);
      expect(store.getState().canRedo).toBe(true);

      await store.getState().actions.redo();
      expect(store.getState().canUndo).toBe(true);
      expect(store.getState().canRedo).toBe(false);
   });
});

// ==================
//  Viewport (not undoable)
// ==================

describe('setViewport', () => {
   it('updates in memory immediately, debounce-persists, and never enters undo', async () => {
      const board = await repository.createBoard('Board');
      const store = createBoardStore({ viewportSaveDebounceMs: 5 });
      await store.getState().actions.hydrate(board.id);

      store.getState().actions.setViewport({ x: 50, y: 60, zoom: 2 });
      expect(store.getState().viewport).toEqual({ x: 50, y: 60, zoom: 2 }); // immediate
      expect(store.getState().canUndo).toBe(false); // not a command

      // Poll for the debounced save rather than a fixed sleep (robust under suite load).
      const persisted = await waitFor(async () => {
         const vp = (await repository.getBoard(board.id))?.viewport;
         return vp && vp.zoom === 2 ? vp : undefined;
      });
      expect(persisted).toEqual({ x: 50, y: 60, zoom: 2 });
      expect(store.getState().canUndo).toBe(false); // still nothing to undo
   });

   it('does not mark the board as last-modified (the viewport is not undoable)', async () => {
      const board = await repository.createBoard('Board');
      const store = createBoardStore({ viewportSaveDebounceMs: 5 });
      await store.getState().actions.hydrate(board.id);

      store.getState().actions.setViewport({ x: 10, y: 10, zoom: 1.5 });
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('drawer'); // unchanged
   });
});

// ==================
//  lastModifiedStore (so Ctrl+Z routes to the board after a board edit)
// ==================

describe('lastModifiedStore', () => {
   it('every mutating action marks the board as the last-modified store', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeRecord('seed', board.id, 0));
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);
      const { actions } = store.getState();
      const general = useAppGeneralStateStore.getState().actions;

      const reset = () => general.setLastModifiedStore('drawer');

      reset();
      await actions.addItem(makeItem('a', 1));
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.moveItem('a', { x: 5, y: 5 });
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.resizeItem('a', { width: 60, height: 60 });
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.setItemZ('a', 9);
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.bringToFront('a');
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.sendToBack('a');
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.updateItemContent('a', { kind: 'post-it', text: 'edited' });
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');

      reset();
      await actions.deleteItem('a');
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('board');
   });

   it('undo and redo do not change the last-modified store', async () => {
      const board = await repository.createBoard('Board');
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);
      await store.getState().actions.addItem(makeItem('a', 0));

      useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
      await store.getState().actions.undo();
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('drawer');
      await store.getState().actions.redo();
      expect(useAppGeneralStateStore.getState().lastModifiedStore).toBe('drawer');
   });
});

// ==================
//  Failure revert
// ==================

describe('failed command', () => {
   it('reverts the optimistic in-memory change to persisted truth and records the error', async () => {
      const board = await repository.createBoard('Board');
      await repository.addItem(makeRecord('item-1', board.id, 0, { x: 0, y: 0 }));
      const store = createBoardStore();
      await store.getState().actions.hydrate(board.id);

      // Delete the row out from under the next command so its do() throws.
      await repository.deleteItem('item-1');

      await expect(store.getState().actions.moveItem('item-1', { x: 999, y: 999 })).rejects.toThrow(/not found/i);

      // The optimistic x:999 is gone; the map matches persisted truth (item absent).
      expect(store.getState().items['item-1']).toBeUndefined();
      expect(store.getState().error).toMatch(/not found/i);
      expect(store.getState().canUndo).toBe(false); // failed do() pushed nothing
   });
});

// ==================
//  Per-instance isolation
// ==================

describe('per-instance isolation', () => {
   it('two stores share no undo history or mutable state', async () => {
      const boardA = await repository.createBoard('A');
      const boardB = await repository.createBoard('B');
      await repository.addItem(makeRecord('a-item', boardA.id, 0, { x: 0 }));
      await repository.addItem(makeRecord('b-item', boardB.id, 0, { x: 0 }));

      const storeA = createBoardStore();
      const storeB = createBoardStore();
      await storeA.getState().actions.hydrate(boardA.id);
      await storeB.getState().actions.hydrate(boardB.id);

      await storeA.getState().actions.moveItem('a-item', { x: 100, y: 0 });
      expect(storeA.getState().canUndo).toBe(true);
      expect(storeB.getState().canUndo).toBe(false); // B's stack is untouched

      // B's view does not see A's items, and undoing A leaves B alone.
      expect(storeB.getState().items['a-item']).toBeUndefined();
      await storeA.getState().actions.undo();
      expect(storeA.getState().items['a-item']).toMatchObject({ x: 0 });
      expect(await repository.getItem('b-item')).toMatchObject({ x: 0 });
      expect(storeB.getState().canUndo).toBe(false);
   });
});
