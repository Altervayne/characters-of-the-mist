// -- React Imports --
import { useEffect } from 'react';

// -- Store Imports --
import { useCharacterStore } from '@/lib/stores/characterStore';
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';



/**
 * Routes the Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Y (redo) keyboard shortcuts to
 * either the character or the drawer temporal store.
 *
 * Routing logic (non-obvious): when the drawer was the most recently modified
 * store AND it is currently open, the shortcuts drive the drawer's undo/redo
 * history; in every other case they drive the character's. Each store's history
 * is read fresh on every keypress via its temporal snapshot, and an action only
 * fires when that store actually has history to move through (more than one past
 * state to undo, at least one future state to redo).
 *
 * @param isDrawerOpen - Whether the drawer is currently open; part of the
 *   routing condition that decides which store the shortcut targets.
 */
export function useCharacterSheetUndoRedo(isDrawerOpen: boolean) {
   const lastModifiedStore = useAppGeneralStateStore((state) => state.lastModifiedStore);

   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         const { undo: undoCharacter, redo: redoCharacter, pastStates: pastStatesCharacter, futureStates: futureStatesCharacter } = useCharacterStore.temporal.getState();
         const { undo: undoDrawer, redo: redoDrawer, pastStates: pastStatesDrawer, futureStates: futureStatesDrawer } = useDrawerStore.temporal.getState();

         const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z';
         const isRedo = (event.ctrlKey || event.metaKey) && event.key === 'y';

         const characterCanUndo = pastStatesCharacter.length > 1
         const characterCanRedo = futureStatesCharacter.length > 0
         const drawerCanUndo = pastStatesDrawer.length > 1
         const drawerCanRedo = futureStatesDrawer.length > 0

         if (!isUndo && !isRedo) return;

         event.preventDefault();

         if (lastModifiedStore === 'drawer' && isDrawerOpen) {
            if (isUndo && drawerCanUndo) undoDrawer();
            if (isRedo && drawerCanRedo) redoDrawer();
         } else {
            if (isUndo && characterCanUndo) undoCharacter();
            if (isRedo && characterCanRedo) redoCharacter();
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, [lastModifiedStore, isDrawerOpen]);
}
