// -- Store Imports --
import { getActiveCharacterStore } from '@/lib/character/characterStoreRegistry';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Drawer Engine Imports --
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';

/*
 * Shared undo/redo routing for the whole app: the Ctrl/Cmd+Z / +Y shortcut and the palette both go
 * through these, so the target and precedence can't drift. Every read is fresh (nothing captured).
 *
 * Precedence: the drawer when it was the last store modified AND is open, else the active board, else the
 * active character (still zundo-based). Each target acts only when it has history; the drawer and board go
 * through their STORE ACTIONS so the folder view / canvas resyncs after the revert. No active target is a
 * no-op.
 */

/** True when the drawer owns undo/redo: it was the last store touched and it is open. */
function drawerHasFocus(): boolean {
   const { lastModifiedStore, isDrawerOpen } = useAppGeneralStateStore.getState();
   return lastModifiedStore === 'drawer' && isDrawerOpen;
}

/** Whether the active context has an undo step available. */
export function canUndoActiveContext(): boolean {
   if (drawerHasFocus()) return drawerCommandEngine.canUndo();
   const boardStore = getActiveBoardStore();
   if (boardStore) return boardStore.getState().canUndo;
   const temporal = getActiveCharacterStore()?.temporal.getState();
   return (temporal?.pastStates.length ?? 0) > 1;
}

/** Whether the active context has a redo step available. */
export function canRedoActiveContext(): boolean {
   if (drawerHasFocus()) return drawerCommandEngine.canRedo();
   const boardStore = getActiveBoardStore();
   if (boardStore) return boardStore.getState().canRedo;
   const temporal = getActiveCharacterStore()?.temporal.getState();
   return (temporal?.futureStates.length ?? 0) > 0;
}

/** Undoes the active context (drawer / board / character), firing only when that target has history. */
export function undoActiveContext(): void {
   if (drawerHasFocus()) {
      if (drawerCommandEngine.canUndo()) void useDrawerStore.getState().actions.undoDrawer();
      return;
   }
   const boardStore = getActiveBoardStore();
   if (boardStore) {
      const board = boardStore.getState();
      if (board.canUndo) void board.actions.undo();
      return;
   }
   const temporal = getActiveCharacterStore()?.temporal.getState();
   if ((temporal?.pastStates.length ?? 0) > 1) temporal?.undo();
}

/** Redoes the active context (drawer / board / character), firing only when that target has a redo step. */
export function redoActiveContext(): void {
   if (drawerHasFocus()) {
      if (drawerCommandEngine.canRedo()) void useDrawerStore.getState().actions.redoDrawer();
      return;
   }
   const boardStore = getActiveBoardStore();
   if (boardStore) {
      const board = boardStore.getState();
      if (board.canRedo) void board.actions.redo();
      return;
   }
   const temporal = getActiveCharacterStore()?.temporal.getState();
   if ((temporal?.futureStates.length ?? 0) > 0) temporal?.redo();
}
