
// -- Other Library Imports --
import { useStoreWithEqualityFn } from 'zustand/traditional';

// -- Store and Hook Imports --
import { useActiveCharacterInstance } from '@/lib/character/ActiveCharacterStoreContext';

// -- Type Imports --
import type { TemporalState } from 'zundo';
import type { CharacterState } from '@/lib/stores/characterStore';

// Only the character is tracked by undo/redo (see the store's `partialize`), so the
// temporal snapshots hold this slice, not the whole state.
type CharacterUndoState = Pick<CharacterState, 'character'>;



/**
 * Reactive subscription to the ACTIVE character store's temporal (undo/redo) state.
 * Use this instead of `getActiveCharacterStore()?.temporal.getState()`; that call is
 * a one-shot snapshot and will not trigger a re-render when undo/redo history
 * changes. The temporal store is resolved from the active instance via context, so
 * the sidebar undo/redo controls track whichever tab is active.
 */
function useCharacterTemporalStore(): TemporalState<CharacterUndoState>;
function useCharacterTemporalStore<T>(selector: (state: TemporalState<CharacterUndoState>) => T): T;
function useCharacterTemporalStore<T>(
   selector: (state: TemporalState<CharacterUndoState>) => T,
   equality?: (a: T, b: T) => boolean,
): T;

function useCharacterTemporalStore<T>(
   selector?: (state: TemporalState<CharacterUndoState>) => T,
   equality?: (a: T, b: T) => boolean,
) {
   const instance = useActiveCharacterInstance();
   return useStoreWithEqualityFn(instance.temporal, selector!, equality);
}



export default useCharacterTemporalStore;
