
// -- Other Library Imports --
import { useStoreWithEqualityFn } from 'zustand/traditional';

// -- Store and Hook Imports --
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { TemporalState } from 'zundo';



type CharacterStoreState = ReturnType<typeof useCharacterStore.getState>;



/**
 * Reactive subscription to the character store's temporal (undo/redo) state.
 * Use this instead of useCharacterStore.temporal.getState(); that call is a
 * one-shot snapshot and will not trigger a re-render when undo/redo history changes.
 */
function useCharacterTemporalStore(): TemporalState<CharacterStoreState>;
function useCharacterTemporalStore<T>(selector: (state: TemporalState<CharacterStoreState>) => T): T;
function useCharacterTemporalStore<T>(
   selector: (state: TemporalState<CharacterStoreState>) => T,
   equality?: (a: T, b: T) => boolean,
): T;

function useCharacterTemporalStore<T>(
   selector?: (state: TemporalState<CharacterStoreState>) => T,
   equality?: (a: T, b: T) => boolean,
) {
   return useStoreWithEqualityFn(useCharacterStore.temporal, selector!, equality);
}



export default useCharacterTemporalStore;
