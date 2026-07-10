// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Component Imports --
import { UndoRedoButtons } from './UndoRedoButtons';

// -- Store and Hook Imports --
import { useActiveNoteInstance } from '@/lib/notes/ActiveNoteStoreContext';

// -- Type Imports --
import type { NoteStore } from '@/lib/stores/noteStore';

/**
 * The sidebar undo/redo control for a note tab, fed from the active note store. The note's ONE undo timeline
 * lives in CM6 (body + title + cover); the mounted editor bridges its `undo`/`redo` + `canUndo`/`canRedo` into
 * the store (see `NoteView`), so this reads them exactly like the board's command-engine equivalent
 * ({@link import('./BoardUndoRedoControls').BoardUndoRedoControls}). In Reading mode (no editor) both are `false`.
 *
 * Outer/inner split mirrors the board: the note context hook returns `NoteStore | null` and `useStore` cannot
 * take null, so the outer renders nothing when no note tab is active (it is only mounted under one anyway).
 */
export function NoteUndoRedoControls({ isCollapsed }: { isCollapsed: boolean }) {
   const instance = useActiveNoteInstance();
   if (!instance) return null;
   return <NoteUndoRedoControlsInner store={instance} isCollapsed={isCollapsed} />;
}

function NoteUndoRedoControlsInner({ store, isCollapsed }: { store: NoteStore; isCollapsed: boolean }) {
   const canUndo = useStore(store, (state) => state.canUndo);
   const canRedo = useStore(store, (state) => state.canRedo);
   const actions = useStore(store, (state) => state.actions);

   return (
      <UndoRedoButtons
         controller={{ undo: () => actions.undo(), redo: () => actions.redo(), canUndo, canRedo }}
         isCollapsed={isCollapsed}
      />
   );
}
