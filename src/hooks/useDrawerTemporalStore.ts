

// -- Other Library Imports --
import { useStoreWithEqualityFn } from 'zustand/traditional';

// -- Store and Hook Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Type Imports --
import type { TemporalState } from 'zundo';
import type { DrawerState } from '@/lib/stores/drawerStore';



function useDrawerTemporalStore(): TemporalState<DrawerState>;
function useDrawerTemporalStore<T>(selector: (state: TemporalState<DrawerState>) => T): T;
function useDrawerTemporalStore<T>(
   selector: (state: TemporalState<DrawerState>) => T,
   equality?: (a: T, b: T) => boolean,
): T;



function useDrawerTemporalStore<T>(
   selector?: (state: TemporalState<DrawerState>) => T,
   equality?: (a: T, b: T) => boolean,
) {
   return useStoreWithEqualityFn(useDrawerStore.temporal, selector!, equality);
}



export default useDrawerTemporalStore;