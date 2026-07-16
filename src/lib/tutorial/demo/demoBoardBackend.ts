// -- Board Data Layer Imports --
import { BOARD_SCHEMA_VERSION, DEFAULT_BOARD_GRID } from '@/lib/board/boardRecords';
import { BoardNotFoundError } from '@/lib/board/boardErrors';

// -- Local Imports --
import { isDemoId } from './demoSentinels';

// -- Type Imports --
import type { BoardItemRecord, BoardRecord } from '@/lib/board/boardRecords';
import type { Board, BoardItem, Viewport } from '@/lib/types/board';

/*
 * The per-id in-memory backend the board repository funnels a demo board through. The board store is
 * persist-then-resync - every command writes the repository and the in-memory `items` map is rebuilt
 * FROM it - so a no-op-writes adapter would reload an empty board. Instead this owns a full in-memory
 * aggregate (record + items) for a demo board id: the repository routes every read AND write for that id
 * here, touching Dexie for NOTHING. Real gestures and undo work exactly as they do on a real board; the
 * whole thing is discarded on teardown.
 *
 * Board ownership is by the sentinel PREFIX (`isDemoId`), not by presence in the map: a demo board id can
 * NEVER reach Dexie, whether or not its aggregate is currently installed - so a beat that fires a write
 * after teardown lands on a graceful in-memory no-op rather than leaking a ghost row. Item ownership is by
 * a reverse index (a live demo item's id is a plain cuid, so the prefix can't decide it).
 *
 * A pure leaf: no store, no Dexie, no React, and crucially no import of the repository it backs (which
 * imports this) - only board types, the record constants, and the sentinel predicate.
 */

/** One demo board held entirely in memory: its record plus its items keyed by id. */
interface DemoBoardAggregate {
   record: BoardRecord;
   items: Map<string, BoardItemRecord>;
}

/** Demo boardId -> its in-memory aggregate. Multiple ids coexist (the portal graph installs several). */
const boards = new Map<string, DemoBoardAggregate>();

/** Item id -> owning demo boardId, for the item-keyed repository functions (which carry no boardId). */
const itemOwner = new Map<string, string>();

/** True for any demo board id (installed or not), so its writes can never fall through to Dexie. */
export function ownsBoard(id: string): boolean {
   return isDemoId(id);
}

/** True only for an item currently held by an installed demo board. */
export function ownsItem(id: string): boolean {
   return itemOwner.has(id);
}

/** Loads a demo board aggregate into the backend (hydrated by the seed, then read back through `loadBoard`). */
export function installDemoBoard(board: Board): void {
   const items = new Map<string, BoardItemRecord>();
   for (const item of board.items) {
      const record: BoardItemRecord = { ...item, boardId: board.id };
      items.set(record.id, record);
      itemOwner.set(record.id, board.id);
   }
   const record: BoardRecord = {
      id: board.id,
      name: board.name,
      updatedAt: Date.now(),
      viewport: board.viewport,
      drawerItemId: board.drawerItemId ?? null,
      grid: board.grid ?? { ...DEFAULT_BOARD_GRID },
      nextLayerSeq: board.nextLayerSeq,
      schemaVersion: BOARD_SCHEMA_VERSION,
   };
   boards.set(board.id, { record, items });
}

/** Drops a demo board and forgets its items. Idempotent. */
export function disposeDemoBoard(id: string): void {
   const aggregate = boards.get(id);
   if (!aggregate) return;
   for (const itemId of aggregate.items.keys()) itemOwner.delete(itemId);
   boards.delete(id);
}

// ==================
//  Internal helpers - emulate the repository's projection + z-ordering
// ==================

/** Projects a flat item record onto the assembled {@link BoardItem} (drops `boardId`), like the repository. */
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
      zoneId: record.zoneId,
      label: record.label,
      content: record.content,
   };
}

/** A demo board's items in z-order (mirrors the repository's `[boardId+z]` index read); ties broken by id. */
function orderedRecords(aggregate: DemoBoardAggregate): BoardItemRecord[] {
   return [...aggregate.items.values()].sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
}

/** Assembles the {@link Board} aggregate for a demo board record + its items (mirrors `loadBoard`). */
function assemble(aggregate: DemoBoardAggregate): Board {
   return {
      id: aggregate.record.id,
      name: aggregate.record.name,
      viewport: aggregate.record.viewport,
      drawerItemId: aggregate.record.drawerItemId ?? null,
      grid: aggregate.record.grid ?? { ...DEFAULT_BOARD_GRID },
      nextLayerSeq: aggregate.record.nextLayerSeq,
      items: orderedRecords(aggregate).map(toBoardItem),
   };
}

// ==================
//  Routed repository functions - the demo half of each `boardRepository` export
// ==================
//
// Each mirrors its Dexie sibling's contract, but reads/writes the in-memory aggregate. Values are
// `structuredClone`d across the boundary to match Dexie's detached-copy semantics (a caller mutating a
// returned record must not corrupt the backend), and to keep the demo board content structuredClone-safe.

/** {@link import('@/lib/board/boardRepository').getBoard} for a demo board. */
export async function getBoard(id: string): Promise<BoardRecord | undefined> {
   const aggregate = boards.get(id);
   return aggregate ? structuredClone(aggregate.record) : undefined;
}

/** {@link import('@/lib/board/boardRepository').loadBoard} for a demo board. */
export async function loadBoard(id: string): Promise<Board | undefined> {
   const aggregate = boards.get(id);
   return aggregate ? structuredClone(assemble(aggregate)) : undefined;
}

/** {@link import('@/lib/board/boardRepository').listItems} for a demo board. */
export async function listItems(boardId: string): Promise<BoardItemRecord[]> {
   const aggregate = boards.get(boardId);
   if (!aggregate) return [];
   return orderedRecords(aggregate).map((record) => structuredClone(record));
}

/** {@link import('@/lib/board/boardRepository').getItem} for a demo board item. */
export async function getItem(id: string): Promise<BoardItemRecord | undefined> {
   const boardId = itemOwner.get(id);
   const record = boardId !== undefined ? boards.get(boardId)?.items.get(id) : undefined;
   return record ? structuredClone(record) : undefined;
}

/** {@link import('@/lib/board/boardRepository').saveBoard} for a demo board. No-op on an absent (disposed) id. */
export async function saveBoard(board: BoardRecord): Promise<BoardRecord> {
   const record: BoardRecord = { ...structuredClone(board), updatedAt: Date.now() };
   const aggregate = boards.get(board.id);
   if (aggregate) aggregate.record = record;
   return structuredClone(record);
}

/** {@link import('@/lib/board/boardRepository').saveBoardLayerSeq} for a demo board. Idempotent on an absent id. */
export async function saveBoardLayerSeq(id: string, nextLayerSeq: number): Promise<void> {
   const aggregate = boards.get(id);
   if (aggregate) aggregate.record = { ...aggregate.record, nextLayerSeq, updatedAt: Date.now() };
}

/** {@link import('@/lib/board/boardRepository').renameBoard} for a demo board. */
export async function renameBoard(id: string, name: string): Promise<void> {
   const aggregate = boards.get(id);
   if (!aggregate) throw new BoardNotFoundError(`Board not found: ${id}`);
   aggregate.record = { ...aggregate.record, name, updatedAt: Date.now() };
}

/** {@link import('@/lib/board/boardRepository').addItem} / `putItem` for a demo board item. */
export async function putItem(record: BoardItemRecord): Promise<void> {
   const aggregate = boards.get(record.boardId);
   if (!aggregate) return; // an unknown (disposed) demo board: drop the write, never Dexie
   const stored = structuredClone(record);
   aggregate.items.set(stored.id, stored);
   itemOwner.set(stored.id, stored.boardId);
}

/** {@link import('@/lib/board/boardRepository').updateItem} for a demo board item. */
export async function updateItem(id: string, patch: Partial<Omit<BoardItemRecord, 'id' | 'boardId'>>): Promise<void> {
   const boardId = itemOwner.get(id);
   const aggregate = boardId !== undefined ? boards.get(boardId) : undefined;
   const existing = aggregate?.items.get(id);
   if (!aggregate || !existing) throw new BoardNotFoundError(`Board item not found: ${id}`);
   aggregate.items.set(id, { ...existing, ...structuredClone(patch) });
}

/** {@link import('@/lib/board/boardRepository').deleteItem} for a demo board item. Idempotent on an absent id. */
export async function deleteItem(id: string): Promise<void> {
   const boardId = itemOwner.get(id);
   if (boardId === undefined) return;
   boards.get(boardId)?.items.delete(id);
   itemOwner.delete(id);
}

/**
 * {@link import('@/lib/board/boardRepository').saveBoardToLinkedDrawerItem} for a demo board. The demo board is
 * never linked to a drawer item (and must never touch the real drawer), so it flushes the camera in memory and
 * always reports "not linked" -> the caller routes to "Save As".
 */
export async function saveBoardToLinkedDrawerItem(boardId: string, viewport: Viewport): Promise<{ linkedItemUpdated: boolean }> {
   const aggregate = boards.get(boardId);
   if (aggregate) aggregate.record = { ...aggregate.record, viewport, updatedAt: Date.now() };
   return { linkedItemUpdated: false };
}

/** {@link import('@/lib/board/boardRepository').linkBoardToDrawerItem} for a demo board (in-memory only). */
export async function linkBoardToDrawerItem(boardId: string, drawerItemId: string, viewport: Viewport): Promise<Board> {
   const aggregate = boards.get(boardId);
   if (!aggregate) throw new BoardNotFoundError(`Board not found: ${boardId}`);
   aggregate.record = { ...aggregate.record, drawerItemId, viewport, updatedAt: Date.now() };
   return structuredClone(assemble(aggregate));
}
