// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Component Imports --
import { UndoRedoButtons } from './UndoRedoButtons';

// -- Store and Hook Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';

/**
 * The sidebar undo/redo control for a board tab, fed from the active board store's
 * command engine. (The character equivalent is
 * {@link import('./CharacterUndoRedoControls').CharacterUndoRedoControls}.)
 *
 * Outer/inner split: the board context hook returns `BoardStore | null`, and `useStore`
 * cannot take null, so the outer renders nothing when there is no active board (it is
 * only mounted under a board tab anyway) and the inner subscribes to the guaranteed store.
 */
export function BoardUndoRedoControls({ isCollapsed }: { isCollapsed: boolean }) {
   const instance = useActiveBoardInstance();
   if (!instance) return null;
   return <BoardUndoRedoControlsInner store={instance} isCollapsed={isCollapsed} />;
}

function BoardUndoRedoControlsInner({ store, isCollapsed }: { store: BoardStore; isCollapsed: boolean }) {
   const canUndo = useStore(store, (state) => state.canUndo);
   const canRedo = useStore(store, (state) => state.canRedo);
   const actions = useStore(store, (state) => state.actions);

   // Drive undo/redo through the store actions (not the engine) so the canvas resyncs.
   return (
      <UndoRedoButtons
         controller={{ undo: () => void actions.undo(), redo: () => void actions.redo(), canUndo, canRedo }}
         isCollapsed={isCollapsed}
      />
   );
}
