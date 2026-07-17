// -- Utils Imports --
import { reorderList } from '@/lib/utils/drawer';

// -- Tutorial Demo Imports --
import { getDemoDrawerEngine, subscribeDemoDrawerSession } from '@/lib/tutorial/demo/demoDrawerBackend';

// -- Local Imports --
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';
import { DrawerNotFoundError } from './drawerErrors';
import {
   applyFolderOrder,
   applyItemOrder,
   createFolder,
   createItem,
   deleteFolder,
   deleteItem,
   getFolder,
   getFolderChildren,
   getFolderSubtreeRecords,
   getItem,
   importDrawerAsFolder,
   importNestedFolderAsRecords,
   moveFolder,
   moveItem,
   renameFolder,
   renameItem,
   restoreRecords,
   updateItemContent,
} from './drawerRepository';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord } from './drawerRecords';
import type { Drawer, DrawerItemContent, Folder, GameSystem, GeneralItemType } from '@/lib/types/drawer';

/*
 * Operation/command-based undo for the drawer, replacing zundo. Lazy loading rules
 * out zundo's whole-state snapshots, so each command captures only the inverse delta
 * it needs to revert itself; the engine keeps in-memory undo/redo stacks. Pure logic
 * over the repository - no React, no store, no toasts. Undo is global and
 * navigation-independent: commands operate by id, so they revert correctly regardless
 * of which folder is currently open.
 */

/**
 * A single reversible drawer operation.
 *
 * `do()` performs the operation (and is re-run for redo); `undo()` reverts it
 * using data the command captured. A command captures whatever it needs to revert
 * before/while `do()` mutates, and is written so re-running `do()` from that
 * captured state is id-stable (e.g. a create re-inserts its original record rather
 * than minting a new id).
 */
export interface DrawerCommand {
   /** Diagnostic label (not shown to users). */
   readonly label: string;
   /**
    * Optional coalescing key. Consecutive commands with the same key, executed
    * within the engine's coalescing window, merge into one undo step.
    */
   readonly coalesceKey?: string;
   /** Performs (or redoes) the operation. */
   do(): Promise<void>;
   /** Reverts the operation using captured inverse data. */
   undo(): Promise<void>;
   /**
    * Folds a later coalescing-compatible command into this one: this command keeps
    * its original "before" state and adopts the other's "after" state. Present only
    * on coalescible commands (reorders).
    */
   mergeCoalesced?(next: DrawerCommand): void;
}

/** Translates a stored `parentFolderId` (sentinel or id) back to the API's `string | null`. */
function toApiParent(storedParentFolderId: string): string | null {
   return storedParentFolderId === DRAWER_ROOT_PARENT_ID ? null : storedParentFolderId;
}

// ==================
//  Command set - one per current drawer mutation
// ==================

/** A create command that exposes the id it created (available after `do()` has run). */
export interface DrawerCreateFolderCommand extends DrawerCommand {
   /** The created folder's id once `do()` has run, otherwise `null`. */
   getCreatedFolderId(): string | null;
}

/** Create an empty folder. Undo deletes it; redo re-inserts the original record (id-stable). */
export function createCreateFolderCommand(input: { name: string; parentFolderId: string | null }): DrawerCreateFolderCommand {
   let createdFolder: DrawerFolderRecord | null = null;
   return {
      label: 'create-folder',
      async do() {
         if (createdFolder) await restoreRecords([createdFolder], []);
         else createdFolder = await createFolder(input);
      },
      async undo() {
         if (createdFolder) await deleteFolder(createdFolder.id);
      },
      getCreatedFolderId: () => createdFolder?.id ?? null,
   };
}

/** Rename a folder. Captures the previous name; undo restores it. */
export function createRenameFolderCommand(folderId: string, newName: string): DrawerCommand {
   let previousName: string | null = null;
   return {
      label: 'rename-folder',
      async do() {
         const folder = await getFolder(folderId);
         if (!folder) throw new DrawerNotFoundError(`Drawer folder not found: ${folderId}`);
         previousName = folder.name;
         await renameFolder(folderId, newName);
      },
      async undo() {
         if (previousName !== null) await renameFolder(folderId, previousName);
      },
   };
}

/**
 * Move a folder to a new parent. Captures the original parent and the original
 * source sibling order; undo moves it back and restores that exact order (the
 * destination's order is restored automatically by the move-back's reindex).
 */
export function createMoveFolderCommand(folderId: string, destinationParentFolderId: string | null): DrawerCommand {
   let originalParentFolderId: string | null = null;
   let originalSiblingOrderIds: string[] = [];
   return {
      label: 'move-folder',
      async do() {
         const folder = await getFolder(folderId);
         if (!folder) throw new DrawerNotFoundError(`Drawer folder not found: ${folderId}`);
         originalParentFolderId = toApiParent(folder.parentFolderId);
         originalSiblingOrderIds = (await getFolderChildren(originalParentFolderId)).folders.map((sibling) => sibling.id);
         await moveFolder(folderId, destinationParentFolderId);
      },
      async undo() {
         await moveFolder(folderId, originalParentFolderId);
         await applyFolderOrder(originalParentFolderId, originalSiblingOrderIds);
      },
   };
}

/**
 * Delete a folder and its subtree. Captures the full subtree records and the
 * source sibling order before deleting; undo restores the records verbatim and
 * re-applies the source order.
 */
export function createDeleteFolderCommand(folderId: string): DrawerCommand {
   let capturedSubtree: { folderRecords: DrawerFolderRecord[]; itemRecords: DrawerItemRecord[] } | null = null;
   let sourceParentFolderId: string | null = null;
   let sourceSiblingOrderIds: string[] = [];
   return {
      label: 'delete-folder',
      async do() {
         const folder = await getFolder(folderId);
         if (!folder) throw new DrawerNotFoundError(`Drawer folder not found: ${folderId}`);
         sourceParentFolderId = toApiParent(folder.parentFolderId);
         capturedSubtree = await getFolderSubtreeRecords(folderId);
         sourceSiblingOrderIds = (await getFolderChildren(sourceParentFolderId)).folders.map((sibling) => sibling.id);
         await deleteFolder(folderId);
      },
      async undo() {
         if (!capturedSubtree) return;
         await restoreRecords(capturedSubtree.folderRecords, capturedSubtree.itemRecords);
         await applyFolderOrder(sourceParentFolderId, sourceSiblingOrderIds);
      },
   };
}

/** A create command that exposes the id it created (available after `do()` has run). */
export interface DrawerCreateItemCommand extends DrawerCommand {
   /** The created item's id once `do()` has run, otherwise `null`. */
   getCreatedItemId(): string | null;
}

/** Create an item (honouring a preset id). Undo deletes it; redo re-inserts the original record. */
export function createCreateItemCommand(input: {
   id?: string;
   name: string;
   game: GameSystem;
   type: GeneralItemType;
   content: DrawerItemContent;
   parentFolderId: string | null;
}): DrawerCreateItemCommand {
   let createdItem: DrawerItemRecord | null = null;
   return {
      label: 'create-item',
      async do() {
         if (createdItem) await restoreRecords([], [createdItem]);
         else createdItem = await createItem(input);
      },
      async undo() {
         if (createdItem) await deleteItem(createdItem.id);
      },
      getCreatedItemId: () => createdItem?.id ?? null,
   };
}

/** Rename an item. Captures the previous name; undo restores it. */
export function createRenameItemCommand(itemId: string, newName: string): DrawerCommand {
   let previousName: string | null = null;
   return {
      label: 'rename-item',
      async do() {
         const item = await getItem(itemId);
         if (!item) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
         previousName = item.name;
         await renameItem(itemId, newName);
      },
      async undo() {
         if (previousName !== null) await renameItem(itemId, previousName);
      },
   };
}

/** Move an item to a new parent. Mirrors {@link createMoveFolderCommand} for items. */
export function createMoveItemCommand(itemId: string, destinationParentFolderId: string | null): DrawerCommand {
   let originalParentFolderId: string | null = null;
   let originalSiblingOrderIds: string[] = [];
   return {
      label: 'move-item',
      async do() {
         const item = await getItem(itemId);
         if (!item) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
         originalParentFolderId = toApiParent(item.parentFolderId);
         originalSiblingOrderIds = (await getFolderChildren(originalParentFolderId)).items.map((sibling) => sibling.id);
         await moveItem(itemId, destinationParentFolderId);
      },
      async undo() {
         await moveItem(itemId, originalParentFolderId);
         await applyItemOrder(originalParentFolderId, originalSiblingOrderIds);
      },
   };
}

/** Delete an item. Captures the record and source order; undo restores both. */
export function createDeleteItemCommand(itemId: string): DrawerCommand {
   let capturedRecord: DrawerItemRecord | null = null;
   let sourceParentFolderId: string | null = null;
   let sourceSiblingOrderIds: string[] = [];
   return {
      label: 'delete-item',
      async do() {
         const item = await getItem(itemId);
         if (!item) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
         capturedRecord = item;
         sourceParentFolderId = toApiParent(item.parentFolderId);
         sourceSiblingOrderIds = (await getFolderChildren(sourceParentFolderId)).items.map((sibling) => sibling.id);
         await deleteItem(itemId);
      },
      async undo() {
         if (!capturedRecord) return;
         await restoreRecords([], [capturedRecord]);
         await applyItemOrder(sourceParentFolderId, sourceSiblingOrderIds);
      },
   };
}

/** Replace an item's content (and optionally name). Captures the previous content + name; undo restores them. */
export function createUpdateItemContentCommand(itemId: string, content: DrawerItemContent, name?: string): DrawerCommand {
   let previousContent: DrawerItemContent | null = null;
   let previousName: string | null = null;
   return {
      label: 'update-item-content',
      async do() {
         const item = await getItem(itemId);
         if (!item) throw new DrawerNotFoundError(`Drawer item not found: ${itemId}`);
         previousContent = item.content;
         previousName = item.name;
         await updateItemContent(itemId, content, name);
      },
      async undo() {
         if (previousContent !== null) await updateItemContent(itemId, previousContent, previousName ?? undefined);
      },
   };
}

/**
 * Coalescible reorder of a parent's child folders or items. `do()` captures the
 * pre-reorder order on first run and computes the target via `reorderList` (exact
 * parity with the index-based mutation); undo re-applies the captured "before"
 * order. {@link mergeCoalesced} lets a burst collapse to one undo step: the merged
 * command keeps the burst's original "before" and adopts the latest "after".
 */
class DrawerReorderCommand implements DrawerCommand {
   readonly label: string;
   readonly coalesceKey: string;
   private readonly kind: 'folder' | 'item';
   private readonly parentFolderId: string | null;
   private readonly oldIndex: number;
   private readonly newIndex: number;
   private beforeOrderIds: string[] | null = null;
   /** Public so a coalescing merge can adopt a later command's target order. */
   afterOrderIds: string[] | null = null;

   constructor(kind: 'folder' | 'item', parentFolderId: string | null, oldIndex: number, newIndex: number) {
      this.kind = kind;
      this.parentFolderId = parentFolderId;
      this.oldIndex = oldIndex;
      this.newIndex = newIndex;
      this.label = `reorder-${kind}`;
      this.coalesceKey = `reorder:${kind}:${parentFolderId ?? 'root'}`;
   }

   async do(): Promise<void> {
      if (this.beforeOrderIds === null) {
         const children = await getFolderChildren(this.parentFolderId);
         const orderedIds = this.kind === 'folder'
            ? children.folders.map((folder) => folder.id)
            : children.items.map((item) => item.id);
         this.beforeOrderIds = orderedIds;
         this.afterOrderIds = reorderList(orderedIds, this.oldIndex, this.newIndex);
      }
      await this.applyOrder(this.afterOrderIds as string[]);
   }

   async undo(): Promise<void> {
      if (this.beforeOrderIds !== null) await this.applyOrder(this.beforeOrderIds);
   }

   mergeCoalesced(next: DrawerCommand): void {
      if (next instanceof DrawerReorderCommand && next.afterOrderIds !== null) {
         this.afterOrderIds = next.afterOrderIds;
      }
   }

   private applyOrder(orderedIds: string[]): Promise<void> {
      return this.kind === 'folder'
         ? applyFolderOrder(this.parentFolderId, orderedIds)
         : applyItemOrder(this.parentFolderId, orderedIds);
   }
}

/** Reorder a parent's child folders (coalescible). */
export function createReorderFoldersCommand(parentFolderId: string | null, oldIndex: number, newIndex: number): DrawerCommand {
   return new DrawerReorderCommand('folder', parentFolderId, oldIndex, newIndex);
}

/** Reorder a parent's child items (coalescible). */
export function createReorderItemsCommand(parentFolderId: string | null, oldIndex: number, newIndex: number): DrawerCommand {
   return new DrawerReorderCommand('item', parentFolderId, oldIndex, newIndex);
}

/**
 * Import a nested folder as a new subtree (today's `addImportedFolder`). `do()`
 * imports (deep-re-ID'd) on first run and captures the created subtree; undo
 * deletes it; redo restores the captured records verbatim (id-stable).
 */
export function createImportFolderCommand(folder: Folder, parentFolderId: string | null = null): DrawerCommand {
   let createdTopFolderId: string | null = null;
   let capturedSubtree: { folderRecords: DrawerFolderRecord[]; itemRecords: DrawerItemRecord[] } | null = null;
   return {
      label: 'import-folder',
      async do() {
         if (capturedSubtree) {
            await restoreRecords(capturedSubtree.folderRecords, capturedSubtree.itemRecords);
         } else {
            const created = await importNestedFolderAsRecords(folder, parentFolderId);
            createdTopFolderId = created.id;
            capturedSubtree = await getFolderSubtreeRecords(createdTopFolderId);
         }
      },
      async undo() {
         if (createdTopFolderId) await deleteFolder(createdTopFolderId);
      },
   };
}

/**
 * Import a whole drawer as a single new folder (today's `importDrawerAsFolder`).
 * Same do/undo/redo shape as {@link createImportFolderCommand}.
 */
export function createImportDrawerAsFolderCommand(
   drawer: Drawer,
   folderName: string,
   parentFolderId: string | null = null,
): DrawerCommand {
   let createdTopFolderId: string | null = null;
   let capturedSubtree: { folderRecords: DrawerFolderRecord[]; itemRecords: DrawerItemRecord[] } | null = null;
   return {
      label: 'import-drawer-as-folder',
      async do() {
         if (capturedSubtree) {
            await restoreRecords(capturedSubtree.folderRecords, capturedSubtree.itemRecords);
         } else {
            const created = await importDrawerAsFolder(drawer, folderName, parentFolderId);
            createdTopFolderId = created.id;
            capturedSubtree = await getFolderSubtreeRecords(createdTopFolderId);
         }
      },
      async undo() {
         if (createdTopFolderId) await deleteFolder(createdTopFolderId);
      },
   };
}

// ==================
//  Engine
// ==================

/** The undo/redo engine surface the store drives and mirrors. */
export interface DrawerCommandEngine {
   /** Runs a command and records it for undo (coalescing into the top entry when eligible); clears redo. */
   execute(command: DrawerCommand): Promise<void>;
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

/** Tuning for {@link createDrawerCommandEngine}; defaults are cap 50, window 600 ms. */
export interface DrawerCommandEngineOptions {
   /** Maximum undo depth; oldest entries are dropped beyond it. Default 50. */
   undoLimit?: number;
   /** Coalescing window in milliseconds. Default 600. */
   coalesceWindowMs?: number;
   /** Clock source (injectable for tests). Default {@link Date.now}. */
   now?: () => number;
}

interface UndoStackEntry {
   command: DrawerCommand;
   executedAt: number;
}

/**
 * Creates a command engine with in-memory, per-tab undo/redo stacks. Executing a
 * command clears the redo stack; the undo stack is capped (oldest dropped);
 * coalescing merges consecutive same-key commands within the window. Commands
 * operate by id, so undo/redo are navigation-independent.
 */
export function createDrawerCommandEngine(options: DrawerCommandEngineOptions = {}): DrawerCommandEngine {
   const undoLimit = options.undoLimit ?? 50;
   const coalesceWindowMs = options.coalesceWindowMs ?? 600;
   const now = options.now ?? Date.now;

   const undoStack: UndoStackEntry[] = [];
   let redoStack: DrawerCommand[] = [];
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

/** The real engine, holding the user's own undo history for the whole session. */
export const drawerCommandEngine = createDrawerCommandEngine();

/*
 * A Drawer tutorial runs on its own engine. Routing the repository is only half of the isolation: a demo
 * command executed on the real engine would sit on the user's undo stack after the lesson ended, and undoing
 * it would replay a demo operation - captured against a fixture that no longer exists - onto real records.
 * A separate engine means the real stacks are never touched at all, and the demo's history dies with the
 * fixture it describes. Undo/redo still work normally inside the lesson, on the demo's own edits.
 *
 * The demo engine is not held here: it lives ON the demo session, beside the records it describes, so the two
 * cannot be installed or dropped separately. This module only asks which engine is in charge. The import is
 * one-way at runtime (the backend takes the engine TYPE only), so no cycle forms.
 */

/** The engine every drawer mutation and undo/redo goes through: the demo's while one runs, the real one otherwise. */
export function getActiveDrawerEngine(): DrawerCommandEngine {
   return getDemoDrawerEngine() ?? drawerCommandEngine;
}

const activeListeners = new Set<() => void>();
let unbindActive: (() => void) | null = null;

const notifyActive = (): void => {
   for (const listener of activeListeners) listener();
};

/** Points the stable subscription at whichever engine is now active, and announces the swap. */
function bindActive(): void {
   unbindActive?.();
   unbindActive = getActiveDrawerEngine().subscribe(notifyActive);
   notifyActive();
}

/**
 * Subscribes to the ACTIVE engine's stack changes across swaps, so a mirror set up once keeps reporting the
 * engine actually in charge. Returns an unsubscribe function.
 */
export function subscribeActiveDrawerEngine(listener: () => void): () => void {
   activeListeners.add(listener);
   return () => {
      activeListeners.delete(listener);
   };
}

// The session opening or closing IS the swap, so follow it rather than being told about it separately.
subscribeDemoDrawerSession(bindActive);
bindActive();
