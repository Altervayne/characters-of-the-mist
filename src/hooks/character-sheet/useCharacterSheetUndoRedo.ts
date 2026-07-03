// -- React Imports --
import { useEffect } from 'react';

// -- History Imports --
import { undoActiveContext, redoActiveContext } from '@/lib/history/undoRouting';



/**
 * Wires the Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Y (redo) keyboard shortcuts to the shared
 * routing, which targets the drawer, the active board, or the active character (same
 * precedence for the shortcut and the palette). The routing reads its state fresh on
 * every keypress, so the listener needs no dependencies.
 */
export function useCharacterSheetUndoRedo() {
   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z';
         const isRedo = (event.ctrlKey || event.metaKey) && event.key === 'y';
         if (!isUndo && !isRedo) return;

         event.preventDefault();
         if (isUndo) undoActiveContext();
         if (isRedo) redoActiveContext();
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, []);
}
