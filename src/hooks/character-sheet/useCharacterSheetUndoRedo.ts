// -- React Imports --
import { useEffect } from 'react';

// -- Store Imports --
import { getActiveCharacterStore } from '@/lib/character/characterStoreRegistry';
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Drawer Engine Imports --
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';



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
         // Character history is still zundo (out of scope); the drawer history is
         // now the command engine. Drive the drawer via the store actions so the
         // current-folder view is reloaded after the undo/redo. The character
         // temporal is read from the ACTIVE instance via the registry (tabs spec
         // §4); a null instance (no character open) simply does nothing.
         const characterTemporal = getActiveCharacterStore()?.temporal.getState();
         const { undoDrawer, redoDrawer } = useDrawerStore.getState().actions;

         const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z';
         const isRedo = (event.ctrlKey || event.metaKey) && event.key === 'y';

         const characterCanUndo = (characterTemporal?.pastStates.length ?? 0) > 1
         const characterCanRedo = (characterTemporal?.futureStates.length ?? 0) > 0
         const drawerCanUndo = drawerCommandEngine.canUndo()
         const drawerCanRedo = drawerCommandEngine.canRedo()

         if (!isUndo && !isRedo) return;

         event.preventDefault();

         if (lastModifiedStore === 'drawer' && isDrawerOpen) {
            if (isUndo && drawerCanUndo) void undoDrawer();
            if (isRedo && drawerCanRedo) void redoDrawer();
         } else {
            if (isUndo && characterCanUndo) characterTemporal?.undo();
            if (isRedo && characterCanRedo) characterTemporal?.redo();
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, [lastModifiedStore, isDrawerOpen]);
}
