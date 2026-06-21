// -- Other Library Imports --
import { create } from 'zustand';

// -- Board Data Layer Imports --
import { getBoard, listItems, loadBoard, saveBoard } from '@/lib/board/boardRepository';
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
import type { BoardItem, BoardItemContent, Viewport } from '@/lib/types/board';

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
      deleteItem: (id: string) => Promise<void>;
      /** Sets the camera and debounce-persists it. The viewport is never undoable. */
      setViewport: (viewport: Viewport) => void;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
   };
}

const initialState: Pick<
   BoardState,
   'boardId' | 'name' | 'viewport' | 'items' | 'canUndo' | 'canRedo' | 'isLoading' | 'error'
> = {
   boardId: null,
   name: '',
   viewport: { ...DEFAULT_VIEWPORT },
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
                  set({ boardId, name: board.name, viewport: board.viewport, items, isLoading: false, error: null });
               } catch (error) {
                  set({ isLoading: false, error: toErrorMessage(error) });
               }
            },

            addItem: async (item) => {
               const boardId = get().boardId;
               if (!boardId) return;
               markBoardModified();
               const record: BoardItemRecord = { ...item, boardId };
               set((state) => ({ items: { ...state.items, [item.id]: item } }));
               await runItemMutation(createAddItemCommand(record));
            },

            moveItem: async (id, position) => {
               markBoardModified();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, x: position.x, y: position.y } } }));
               await runItemMutation(createMoveItemCommand(id, position));
            },

            resizeItem: async (id, patch) => {
               markBoardModified();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, ...patch } } }));
               await runItemMutation(createResizeItemCommand(id, patch));
            },

            setItemZ: async (id, z) => {
               // Also covers bringToFront/sendToBack, which delegate here.
               markBoardModified();
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
               markBoardModified();
               const existing = get().items[id];
               if (existing) set((state) => ({ items: { ...state.items, [id]: { ...existing, content } } }));
               await runItemMutation(createUpdateItemContentCommand(id, content));
            },

            deleteItem: async (id) => {
               markBoardModified();
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
