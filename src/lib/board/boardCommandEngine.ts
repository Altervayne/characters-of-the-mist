// -- Type Imports --
import type { BoardCommand } from './boardCommands';

/*
 * Per-instance command engine for a board: in-memory undo/redo stacks over the
 * inverse-delta commands in `boardCommands.ts`. Mirrors the drawer's command engine,
 * but is a factory with NO singleton export - boards are multi-tab, so each board
 * store (board-3) creates and owns its own engine. This surface is the shape a later
 * UndoController will unify across character (zundo) and board tabs; that unifying
 * interface is not built here.
 */

/** The undo/redo engine surface a board store drives and mirrors. */
export interface BoardCommandEngine {
   /** Runs a command and records it for undo (coalescing into the top entry when eligible); clears redo. */
   execute(command: BoardCommand): Promise<void>;
   /** Reverts the most recent command and moves it to the redo stack. No-op when empty. */
   undo(): Promise<void>;
   /** Re-runs the most recently undone command and moves it back to the undo stack. No-op when empty. */
   redo(): Promise<void>;
   /** Whether there is anything to undo. */
   canUndo(): boolean;
   /** Whether there is anything to redo. */
   canRedo(): boolean;
   /** Empties both stacks (e.g. on delete-all / reset). */
   clear(): void;
   /** Subscribes to stack changes; returns an unsubscribe function. */
   subscribe(listener: () => void): () => void;
}

/** Tuning for {@link createBoardCommandEngine}; defaults are cap 50, window 600 ms. */
export interface BoardCommandEngineOptions {
   /** Maximum undo depth; oldest entries are dropped beyond it. Default 50. */
   undoLimit?: number;
   /** Coalescing window in milliseconds. Default 600. */
   coalesceWindowMs?: number;
   /** Clock source (injectable for tests). Default {@link Date.now}. */
   now?: () => number;
}

interface UndoStackEntry {
   command: BoardCommand;
   executedAt: number;
}

/**
 * Creates a command engine with in-memory, per-instance undo/redo stacks. Executing a
 * command clears the redo stack; the undo stack is capped (oldest dropped); coalescing
 * merges consecutive same-key commands within the window. Commands operate by id, so
 * two engines over the same table do not interfere. There is intentionally no
 * singleton - each board owns its own engine.
 */
export function createBoardCommandEngine(options: BoardCommandEngineOptions = {}): BoardCommandEngine {
   const undoLimit = options.undoLimit ?? 50;
   const coalesceWindowMs = options.coalesceWindowMs ?? 600;
   const now = options.now ?? Date.now;

   const undoStack: UndoStackEntry[] = [];
   let redoStack: BoardCommand[] = [];
   const listeners = new Set<() => void>();

   const notify = (): void => {
      for (const listener of listeners) listener();
   };

   return {
      async execute(command) {
         await command.do();

         const topEntry = undoStack[undoStack.length - 1];
         if (
            command.coalesceKey != null &&
            topEntry !== undefined &&
            topEntry.command.coalesceKey === command.coalesceKey &&
            now() - topEntry.executedAt <= coalesceWindowMs &&
            topEntry.command.mergeCoalesced
         ) {
            topEntry.command.mergeCoalesced(command);
            topEntry.executedAt = now();
         } else {
            undoStack.push({ command, executedAt: now() });
            if (undoStack.length > undoLimit) undoStack.shift();
         }

         redoStack = [];
         notify();
      },

      async undo() {
         const entry = undoStack.pop();
         if (!entry) return;
         try {
            await entry.command.undo();
         } catch (error) {
            undoStack.push(entry);
            notify();
            throw error;
         }
         redoStack.push(entry.command);
         notify();
      },

      async redo() {
         const command = redoStack.pop();
         if (!command) return;
         try {
            await command.do();
         } catch (error) {
            redoStack.push(command);
            notify();
            throw error;
         }
         undoStack.push({ command, executedAt: now() });
         if (undoStack.length > undoLimit) undoStack.shift();
         notify();
      },

      canUndo() {
         return undoStack.length > 0;
      },

      canRedo() {
         return redoStack.length > 0;
      },

      clear() {
         undoStack.length = 0;
         redoStack = [];
         notify();
      },

      subscribe(listener) {
         listeners.add(listener);
         return () => {
            listeners.delete(listener);
         };
      },
   };
}
