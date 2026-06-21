// -- Component Imports --
import { UndoRedoButtons } from './UndoRedoButtons';

// -- Store and Hook Imports --
import useCharacterTemporalStore from '@/hooks/useCharacterTemporalStore';

/**
 * The sidebar undo/redo control for a character tab, fed from the active character's
 * zundo temporal store. (The board's equivalent is {@link import('./BoardUndoRedoControls').BoardUndoRedoControls}.)
 */
export function CharacterUndoRedoControls({ isCollapsed }: { isCollapsed: boolean }) {
   const { undo, redo, pastStates, futureStates } = useCharacterTemporalStore((state) => state);

   // zundo keeps the present in `pastStates`, so undo needs more than one entry.
   return (
      <UndoRedoButtons
         controller={{ undo, redo, canUndo: pastStates?.length > 1, canRedo: futureStates?.length > 0 }}
         isCollapsed={isCollapsed}
      />
   );
}
