// -- Other Library Imports --
import { create } from 'zustand';

// -- Board Data Layer Imports --
import { getBoard, linkBoardToDrawerItem, listItems, loadBoard, renameBoard as renameBoardRecord, saveBoard, saveBoardToLinkedDrawerItem, updateItem } from '@/lib/board/boardRepository';
import { DEFAULT_BOARD_GRID } from '@/lib/board/boardRecords';
import { createBoardCommandEngine } from '@/lib/board/boardCommandEngine';
import {
   createAddItemCommand,
   createDeleteItemCommand,
   createMoveItemCommand,
   createResizeItemCommand,
   createSetItemZCommand,
   createUpdateItemContentCommand,
} from '@/lib/board/boardCommands';

// -- Store Imports --
import { useAppGeneralStateStore } from './appGeneralStateStore';

// -- Type Imports --
import type { BoardCommand, ResizePatch } from '@/lib/board/boardCommands';
import type { BoardItemRecord } from '@/lib/board/boardRecords';
import type { Board, BoardGrid, BoardItem, BoardItemContent, Viewport } from '@/lib/types/board';

/*
 * Board store - the React-facing, in-memory view of one open board, backed by the
 * normalized repository and a command/undo engine. It is a synthesis of two existing
 * stores: the per-instance factory shape of the character store (one store per open
 * board, hence one undo stack), and the command-engine wiring of the drawer store
 * (each mutation persists through a command, then the in-memory view resyncs).
 *
 * Item mutations persist inside their commands (each `do()` writes to the repository),
 * so there is no debounced item-save bridge. The only non-command persistence is the
 * viewport (camera state, debounce-saved on the board record) and hydration
 * (`loadBoard` on open). The store is the single owner of both.
 */

/** A fresh board's camera, used until hydration or a missing-board fallback. */
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

/** How long the camera settles before its position is written back to the board record. */
const VIEWPORT_SAVE_DEBOUNCE_MS = 300;

export interface BoardState {
   /** The open board's id, or `null` before the first successful hydrate. */
   boardId: string | null;
   name: string;
   viewport: Viewport;
   /** The background grid style for this board (persisted on the board record). */
   grid: BoardGrid;
   /** The linked drawer `FULL_BOARD` item, or `null` when this board was never saved. */
   drawerItemId: string | null;
   /** True when the board differs from its saved drawer copy, or was never saved (mirrors the character flag). */
   hasUnsavedChanges: boolean;
   /**
    * Items keyed by id for O(1) optimistic updates; the canvas renders them sorted by
    * `z`. Connections are items too (`kind: 'connection'`), in this same map.
    */
   items: Record<string, BoardItem>;
   canUndo: boolean;
   canRedo: boolean;
   isLoading: boolean;
   error: string | null;
   actions: {
      /** Loads a board into the store, clearing undo history so it can't cross boards. Tolerates a missing board. */
      hydrate: (boardId: string) => Promise<void>;
      addItem: (item: BoardItem) => Promise<void>;
      moveItem: (id: string, position: { x: number; y: number }) => Promise<void>;
      resizeItem: (id: string, patch: ResizePatch) => Promise<void>;
      setItemZ: (id: string, z: number) => Promise<void>;
      /** Raises an item above all others (`max(z) + 1` over the live items). */
      bringToFront: (id: string) => Promise<void>;
      /** Drops an item below all others (`min(z) - 1` over the live items). */
      sendToBack: (id: string) => Promise<void>;
      updateItemContent: (id: string, content: BoardItemContent) => Promise<void>;
      /**
       * Caches a reference item's `lastKnown` snapshot via a DIRECT repo write, never a
       * command - so a passive source-driven re-read never lands on the board undo stack.
       */
      cacheReferenceLastKnown: (id: string, content: BoardItemContent) => Promise<void>;
      deleteItem: (id: string) => Promise<void>;
      /** Sets the camera and debounce-persists it. The viewport is never undoable. */
      setViewport: (viewport: Viewport) => void;
      /** Sets the background grid, persisting it immediately. Marks the board dirty; not undoable. */
      setGrid: (grid: BoardGrid) => Promise<void>;
      /** Renames the board, persisting immediately. Marks the board dirty; not undoable (the tab label is bound to `name`). */
      renameBoard: (name: string) => Promise<void>;
      /** Sets the unsaved-changes flag directly (e.g. a save site marks the board clean). */
      setHasUnsavedChanges: (value: boolean) => void;
      /**
       * Saves the board to its LINKED drawer item (if any), flushing the live viewport.
       * Marks the board clean on success. Returns the outcome, or `null` when no board is
       * loaded; `{ linkedItemUpdated: false }` means the caller should "Save As".
       */
      saveToDrawer: () => Promise<{ linkedItemUpdated: boolean } | null>;
      /**
       * Links the board to a new drawer item id (for "Save As"), flushes the viewport,
       * marks the board clean, and returns the aggregate to seed that drawer item.
       */
      linkToDrawerItem: (drawerItemId: string) => Promise<Board | null>;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
   };
}

const initialState: Pick<
   BoardState,
   'boardId' | 'name' | 'viewport' | 'grid' | 'drawerItemId' | 'hasUnsavedChanges' | 'items' | 'canUndo' | 'canRedo' | 'isLoading' | 'error'
> = {
   boardId: null,
   name: '',
   viewport: { ...DEFAULT_VIEWPORT },
   grid: { ...DEFAULT_BOARD_GRID },
   drawerItemId: null,
   hasUnsavedChanges: false,
   items: {},
   canUndo: false,
   canRedo: false,
   isLoading: false,
   error: null,
};

/** Normalizes a thrown value into the store's `error` message string. */
function toErrorMessage(error: unknown): string {
   return error instanceof Error ? error.message : String(error);
}

/** Marks the board as the most recently modified store, so Ctrl/Cmd+Z routes here (not the drawer). */
function markBoardModified(): void {
   useAppGeneralStateStore.getState().actions.setLastModifiedStore('board');
}

/** Projects a flat item record onto the in-memory {@link BoardItem} (drops `boardId`). */
function recordToItem(record: BoardItemRecord): BoardItem {
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

/** A trailing-edge debouncer; at most one timer in flight. No new dependency. */
function createDebouncer<T>(delay: number, run: (value: T) => void): (value: T) => void {
   let timer: ReturnType<typeof setTimeout> | null = null;
   return (value: T) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
         timer = null;
         run(value);
      }, delay);
   };
}

/**
 * Builds a board store instance: the in-memory board view plus the action API, each
 * instance owning its own command engine (so N open boards = N undo stacks). The
 * `viewportSaveDebounceMs` option exists for tests; production uses the default.
 */
export function createBoardStore(options: { viewportSaveDebounceMs?: number } = {}) {
   const viewportSaveDebounceMs = options.viewportSaveDebounceMs ?? VIEWPORT_SAVE_DEBOUNCE_MS;
   // This instance's own engine, so its undo/redo stacks never cross-wire with another
   // board's. The `subscribe` mirror below is wired to THIS engine only.
   const engine = createBoardCommandEngine();

   const useStore = create<BoardState>()((set, get) => {
      /** Rebuilds the `items` map from persisted truth, leaving `name`/`viewport` (not item rows) alone. */
      const syncItemsFromRepo = async (): Promise<void> => {
         const boardId = get().boardId;
         if (!boardId) return;
         // v1 reloads every item; a per-item diff is a later optimization.
         const records = await listItems(boardId);
         const items: Record<string, BoardItem> = {};
         for (const record of records) items[record.id] = recordToItem(record);
         set({ items });
      };

      /**
       * Persists the camera onto the board record. Best-effort and decoupled from undo:
       * the viewport is never a command, so a failed save never corrupts a stack.
       */
      const debouncedSaveViewport = createDebouncer<Viewport>(viewportSaveDebounceMs, (viewport) => {
         const boardId = get().boardId;
         if (!boardId) return;
         void getBoard(boardId)
            .then((record) => (record ? saveBoard({ ...record, viewport }) : undefined))
            .catch((error) => {
               console.error('Board viewport save failed:', error);
            });
      });

      /**
       * Executes a command through this instance's engine, then resyncs the in-memory
       * map to persisted truth. On failure it records the error, resyncs (reverting the
       * optimistic change the caller already applied), and rethrows.
       */
      const runItemMutation = async (command: BoardCommand): Promise<void> => {
         try {
            await engine.execute(command);
         } catch (error) {
            set({ error: toErrorMessage(error) });
            await syncItemsFromRepo();
            throw error;
         }
         await syncItemsFromRepo();
      };

      /** Marks a real edit: routes Ctrl/Cmd+Z here AND flags the board dirty (so close warns). */
      const markDirty = (): void => {
         markBoardModified();
         set({ hasUnsavedChanges: true });
      };

      return {
         ...initialState,
         actions: {
            hydrate: async (boardId) => {
               // A freshly opened board starts with empty undo history.
               engine.clear();
               set({ isLoading: true, error: null });
               try {
                  const board = await loadBoard(boardId);
                  if (!board) {
                     set({ ...initialState, error: `Board not found: ${boardId}` });
                     return;
                  }
                  const items: Record<string, BoardItem> = {};
                  for (const item of board.items) items[item.id] = item;
                  // Opened from its records: it matches its saved copy (if any), so it
                  // starts clean. The first mutation dirties it.
                  set({ boardId, name: board.name, viewport: board.viewport, grid: board.grid ?? { ...DEFAULT_BOARD_GRID }, drawerItemId: board.drawerItemId ?? null, hasUnsavedChanges: false, items, isLoading: false, error: null });
               } catch (error) {
                  set({ isLoading: false, error: toErrorMessage(error) });
               }
            },

            addItem: async (item) => {
               const boardId = get().boardId;
               if (!boardId) return;
               markDirty();
               const record: BoardItemRecord = { ...item, boardId };
               set((state) => ({ items: { ...state.items, [item.id]: item } }));
               await runItemMutation(createAddItemCommand(record));
            },

            moveItem: async (id, position) => {
               markDirty();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, x: position.x, y: position.y } } }));
               await runItemMutation(createMoveItemCommand(id, position));
            },

            resizeItem: async (id, patch) => {
               markDirty();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, ...patch } } }));
               await runItemMutation(createResizeItemCommand(id, patch));
            },

            setItemZ: async (id, z) => {
               // Also covers bringToFront/sendToBack, which delegate here.
               markDirty();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, z } } }));
               await runItemMutation(createSetItemZCommand(id, z));
            },

            bringToFront: async (id) => {
               const zs = Object.values(get().items).map((item) => item.z);
               const z = zs.length > 0 ? Math.max(...zs) + 1 : 0;
               await get().actions.setItemZ(id, z);
            },

            sendToBack: async (id) => {
               const zs = Object.values(get().items).map((item) => item.z);
               const z = zs.length > 0 ? Math.min(...zs) - 1 : 0;
               await get().actions.setItemZ(id, z);
            },

            updateItemContent: async (id, content) => {
               markDirty();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, content } } }));
               await runItemMutation(createUpdateItemContentCommand(id, content));
            },

            cacheReferenceLastKnown: async (id, content) => {
               // NOT a command and NOT markBoardModified: a reference passively mirroring
               // its source must never pollute the board's undo stack or Ctrl+Z routing.
               const existing = get().items[id];
               if (!existing) return;
               set((state) => ({ items: { ...state.items, [id]: { ...existing, content } } }));
               try {
                  await updateItem(id, { content });
               } catch (error) {
                  set({ error: toErrorMessage(error) });
               }
            },

            deleteItem: async (id) => {
               markDirty();
               set((state) => {
                  const items = { ...state.items };
                  delete items[id];
                  return { items };
               });
               await runItemMutation(createDeleteItemCommand(id));
            },

            setViewport: (viewport) => {
               // Camera state: applied in memory and debounce-saved, never undoable.
               set({ viewport });
               debouncedSaveViewport(viewport);
            },

            setGrid: async (grid) => {
               const boardId = get().boardId;
               if (!boardId) return;
               // A discrete choice: apply, persist immediately (with the live camera, so an
               // in-flight viewport debounce isn't clobbered), and dirty the board. Not undoable.
               set({ grid });
               markDirty();
               const record = await getBoard(boardId);
               if (record) await saveBoard({ ...record, grid, viewport: get().viewport });
            },

            renameBoard: async (name) => {
               const boardId = get().boardId;
               if (!boardId) return;
               // The tab label is bound to `name`, so this updates the tab live. Persisted
               // directly (name only), dirtying the board; not undoable, like the viewport.
               set({ name });
               markDirty();
               await renameBoardRecord(boardId, name);
            },

            setHasUnsavedChanges: (value) => {
               set({ hasUnsavedChanges: value });
            },

            saveToDrawer: async () => {
               const { boardId, viewport } = get();
               if (!boardId) return null;
               const result = await saveBoardToLinkedDrawerItem(boardId, viewport);
               if (result.linkedItemUpdated) set({ hasUnsavedChanges: false });
               return result;
            },

            linkToDrawerItem: async (drawerItemId) => {
               const { boardId, viewport } = get();
               if (!boardId) return null;
               const aggregate = await linkBoardToDrawerItem(boardId, drawerItemId, viewport);
               set({ drawerItemId, hasUnsavedChanges: false });
               return aggregate;
            },

            undo: async () => {
               // The engine reverts the repo; the in-memory view re-reads to match.
               await engine.undo();
               await syncItemsFromRepo();
            },
            redo: async () => {
               await engine.redo();
               await syncItemsFromRepo();
            },
         },
      };
   });

   // Mirror THIS instance's engine into its own canUndo/canRedo so React tracks this
   // board's stacks (not a module-level singleton, unlike the drawer's single store).
   engine.subscribe(() => {
      useStore.setState({ canUndo: engine.canUndo(), canRedo: engine.canRedo() });
   });

   return useStore;
}

/** A single board store instance: the in-memory board view + actions, with its own undo stack. */
export type BoardStore = ReturnType<typeof createBoardStore>;
