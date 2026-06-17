// -- Store Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';

/**
 * Reads the drawer's undo/redo availability and the actions that drive it
 * (migration spec §3.3). Replaces `useDrawerTemporalStore`: `canUndo`/`canRedo`
 * are mirrored from the command engine into the store, and `undo`/`redo` map to
 * the store's `undoDrawer`/`redoDrawer` (which run the engine then reload the
 * current folder).
 *
 * @returns `{ canUndo, canRedo, undo, redo }`.
 */
export function useDrawerUndoRedo() {
   const canUndo = useDrawerStore((state) => state.canUndo);
   const canRedo = useDrawerStore((state) => state.canRedo);
   const { undoDrawer, redoDrawer } = useDrawerActions();

   return { canUndo, canRedo, undo: undoDrawer, redo: redoDrawer };
}
