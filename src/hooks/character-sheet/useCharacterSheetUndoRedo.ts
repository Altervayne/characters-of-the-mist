// -- React Imports --
import { useEffect } from 'react';

// -- Store Imports --
import { getActiveCharacterStore } from '@/lib/character/characterStoreRegistry';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Drawer Engine Imports --
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';



/**
 * Routes the Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Y (redo) keyboard shortcuts to the
 * drawer, the active board, or the active character.
 *
 * Routing precedence (non-obvious): when the drawer was the most recently modified
 * store AND it is open, the shortcuts drive the drawer's history. Otherwise, when a
 * board tab is active they drive that board's command engine. Otherwise they drive the
 * active character's temporal. Each target's history is read fresh on every keypress,
 * and an action only fires when that target has history to move through. The board (like
 * the drawer) goes through its STORE ACTIONS so the canvas resyncs after the revert.
 *
 * @param isDrawerOpen - Whether the drawer is currently open; part of the
 *   routing condition that decides which store the shortcut targets.
 */
export function useCharacterSheetUndoRedo(isDrawerOpen: boolean) {
   const lastModifiedStore = useAppGeneralStateStore((state) => state.lastModifiedStore);

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z';
         const isRedo = (event.ctrlKey || event.metaKey) && event.key === 'y';
         if (!isUndo && !isRedo) return;

         event.preventDefault();

         // Drawer keeps first precedence when it is the active-and-open target. Drive it
         // via the store actions so the current-folder view reloads after the undo/redo.
         if (lastModifiedStore === 'drawer' && isDrawerOpen) {
            const { undoDrawer, redoDrawer } = useDrawerStore.getState().actions;
            if (isUndo && drawerCommandEngine.canUndo()) void undoDrawer();
            if (isRedo && drawerCommandEngine.canRedo()) void redoDrawer();
            return;
         }

         // A board tab is active: drive its command engine through the store actions
         // (read fresh, like the character below) so the canvas reflects the revert.
         const boardStore = getActiveBoardStore();
         if (boardStore) {
            const board = boardStore.getState();
            if (isUndo && board.canUndo) void board.actions.undo();
            if (isRedo && board.canRedo) void board.actions.redo();
            return;
         }

         // Otherwise the active character (still zundo; out of scope). A null instance
         // (no character open) simply does nothing.
         const characterTemporal = getActiveCharacterStore()?.temporal.getState();
         const characterCanUndo = (characterTemporal?.pastStates.length ?? 0) > 1;
         const characterCanRedo = (characterTemporal?.futureStates.length ?? 0) > 0;
         if (isUndo && characterCanUndo) characterTemporal?.undo();
         if (isRedo && characterCanRedo) characterTemporal?.redo();
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, [lastModifiedStore, isDrawerOpen]);
}
