// -- Library Imports --
import { Dexie, type Table } from 'dexie';
import cuid from 'cuid';

// -- Local Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { BOARD_SCHEMA_VERSION } from './boardRecords';
import { BoardNotFoundError, BoardTransactionError } from './boardErrors';

// -- Type Imports --
import type { BoardItemRecord, BoardRecord } from './boardRecords';
import type { Board, BoardItem, Viewport } from '@/lib/types/board';

/*
 * Framework-agnostic data-access layer for boards. Pure persistence: no React, no
 * zustand, no toasts, no console. The board is normalized like the drawer - a board
 * row plus flat item rows - so a large board can load lazily and (prompt 2) mutate
 * per-item under a command engine. Every multi-row op runs in one Dexie transaction;
 * errors are thrown as the typed errors in `boardErrors.ts`. Nothing outside this
 * module touches `db.boards`/`db.boardItems`.
 */

/** A fresh board's camera: origin, no zoom. The viewport persists thereafter. */
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// ==================
//  Transaction wrappers
// ==================

/**
 * Runs `work` in a read/write transaction over `tables`. {@link BoardNotFoundError}
 * propagates unchanged so callers can branch on it; any other failure aborts the
 * transaction (rolling back every write) and is rethrown as a
 * {@link BoardTransactionError} preserving the original cause.
 */
async function runWriteTransaction<T>(tables: Table[], work: () => Promise<T>): Promise<T> {
   try {
      return await db.transaction('rw', tables, work);
   } catch (error) {
      if (error instanceof BoardNotFoundError) throw error;
      throw new BoardTransactionError(
         `Board write transaction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
         { cause: error },
      );
   }
}

/** Runs `work` in a read-only transaction over `tables`, with the same error translation. */
async function runReadTransaction<T>(tables: Table[], work: () => Promise<T>): Promise<T> {
   try {
      return await db.transaction('r', tables, work);
   } catch (error) {
      if (error instanceof BoardNotFoundError) throw error;
      throw new BoardTransactionError(
         `Board read transaction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
         { cause: error },
      );
   }
}

// ==================
//  Internal helpers
// ==================

/** A board item's flat record, z-ordered, via the `[boardId+z]` index. */
function orderedItems(boardId: string): Promise<BoardItemRecord[]> {
   return db.boardItems
      .where('[boardId+z]')
      .between([boardId, Dexie.minKey], [boardId, Dexie.maxKey])
      .toArray();
}

/** Projects a flat item record onto the assembled {@link BoardItem} aggregate. */
function toBoardItem(record: BoardItemRecord): BoardItem {
   return {
      id: record.id,
      kind: record.kind,
      x: record.x,
      y: record.y,
      width: record.width,
      height: record.height,
      z: record.z,
      rotation: record.rotation,
      content: record.content,
   };
}

// ==================
//  Boards
// ==================

/** Creates a new, empty board with a fresh id and the default viewport. Returns the stored record. */
export function createBoard(name: string): Promise<BoardRecord> {
   return runWriteTransaction([db.boards], async () => {
      const record: BoardRecord = {
         id: cuid(),
         name,
         updatedAt: Date.now(),
         viewport: { ...DEFAULT_VIEWPORT },
         schemaVersion: BOARD_SCHEMA_VERSION,
      };
      await db.boards.add(record);
      return record;
   });
}

/** Loads a board record by id, or `undefined` if it does not exist. */
export function getBoard(id: string): Promise<BoardRecord | undefined> {
   return db.boards.get(id);
}

/** Lists all board records, most-recently-updated first (for a future recents list). */
export function listBoards(): Promise<BoardRecord[]> {
   return db.boards.orderBy('updatedAt').reverse().toArray();
}

/** Upserts a board record, refreshing `updatedAt`. Returns the stored record. */
export function saveBoard(board: BoardRecord): Promise<BoardRecord> {
   return runWriteTransaction([db.boards], async () => {
      const record: BoardRecord = { ...board, updatedAt: Date.now() };
      await db.boards.put(record);
      return record;
   });
}

/** Renames a board, refreshing `updatedAt`. Throws {@link BoardNotFoundError} if absent. */
export function renameBoard(id: string, name: string): Promise<void> {
   return runWriteTransaction([db.boards], async () => {
      const updated = await db.boards.update(id, { name, updatedAt: Date.now() });
      if (!updated) throw new BoardNotFoundError(`Board not found: ${id}`);
   });
}

/**
 * Deletes a board and CASCADE-deletes its items in the same transaction, so no
 * orphan `boardItems` are left behind. Idempotent: deleting an absent board is a no-op.
 */
export function deleteBoard(id: string): Promise<void> {
   return runWriteTransaction([db.boards, db.boardItems], async () => {
      await db.boardItems.where('boardId').equals(id).delete();
      await db.boards.delete(id);
   });
}

// ==================
//  Items
// ==================

/** Inserts or replaces a single board item. */
export function addItem(record: BoardItemRecord): Promise<void> {
   return runWriteTransaction([db.boardItems], async () => {
      await db.boardItems.put(record);
   });
}

/** Loads a single item record by id, or `undefined` if it does not exist. */
export function getItem(id: string): Promise<BoardItemRecord | undefined> {
   return db.boardItems.get(id);
}

/** Lists a board's items in z-order, via the `[boardId+z]` index. */
export function listItems(boardId: string): Promise<BoardItemRecord[]> {
   return orderedItems(boardId);
}

/** Inserts or replaces a single board item (alias of {@link addItem} for symmetry). */
export function putItem(record: BoardItemRecord): Promise<void> {
   return addItem(record);
}

/**
 * Patches an item's placement / content / z / rotation. Throws
 * {@link BoardNotFoundError} if the item does not exist. `id`/`boardId` are immutable.
 */
export function updateItem(id: string, patch: Partial<Omit<BoardItemRecord, 'id' | 'boardId'>>): Promise<void> {
   return runWriteTransaction([db.boardItems], async () => {
      const updated = await db.boardItems.update(id, patch);
      if (!updated) throw new BoardNotFoundError(`Board item not found: ${id}`);
   });
}

/** Deletes a single item. Idempotent: deleting an absent id is a no-op. */
export function deleteItem(id: string): Promise<void> {
   return runWriteTransaction([db.boardItems], async () => {
      await db.boardItems.delete(id);
   });
}

/**
 * Lists EVERY board item across all boards, for the asset GC's reference scan (which
 * must see board images, or board art is reclaimed once past the grace window). Reads
 * the whole `boardItems` table; the sweep runs rarely, so the full read is fine.
 */
export function listAllBoardItems(): Promise<BoardItemRecord[]> {
   return db.boardItems.toArray();
}

/** Inserts/replaces many items atomically (for the command engine's multi-item mutations). */
export function bulkPutItems(records: BoardItemRecord[]): Promise<void> {
   return runWriteTransaction([db.boardItems], async () => {
      await db.boardItems.bulkPut(records);
   });
}

/** Deletes many items atomically. Absent ids are no-ops. */
export function bulkDeleteItems(ids: string[]): Promise<void> {
   return runWriteTransaction([db.boardItems], async () => {
      await db.boardItems.bulkDelete(ids);
   });
}

// ==================
//  Aggregate read
// ==================

/**
 * Reads a board and its z-ordered items in one read transaction and assembles the
 * {@link Board} aggregate. Returns `undefined` when the board does not exist. The
 * inverse (aggregate -> records, for drawer-save/export) is a later prompt.
 */
export function loadBoard(id: string): Promise<Board | undefined> {
   return runReadTransaction([db.boards, db.boardItems], async () => {
      const record = await db.boards.get(id);
      if (!record) return undefined;
      const items = await orderedItems(id);
      return {
         id: record.id,
         name: record.name,
         viewport: record.viewport,
         items: items.map(toBoardItem),
      };
   });
}

/** Deletes all board + board-item rows (powers "Reset app"), mirroring `clearAllAssets`. */
export function clearAllBoards(): Promise<void> {
   return runWriteTransaction([db.boards, db.boardItems], async () => {
      await db.boards.clear();
      await db.boardItems.clear();
   });
}
