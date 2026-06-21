// -- React Imports --
import { useMemo, type ReactNode } from 'react';

// -- Local Imports --
import { ActiveCharacterStoreContext } from './ActiveCharacterStoreContext';
import { getMenuFallbackInstance, getOrCreateInstance } from './characterStoreRegistry';
import { useTabManagerStore } from './tabManagerStore';

/*
 * Provider for {@link ActiveCharacterStoreContext}. Kept in its own component-only
 * file so the context object and the resolving hook can live in a plain `.ts`
 * module; this separation keeps `react-refresh/only-export-components` happy without
 * changing any consumer import.
 */

/**
 * Provides the ACTIVE character store instance to its subtree, following the
 * TabManager's `activeTabId`: the instance for the active tab when that tab is a
 * character, or the permanent menu fallback instance otherwise (no active tab, or an
 * active BOARD tab - whose id keys a board store, never a character one). The value is
 * memoized on the active id + type so its reference is stable per active id; supplying
 * a fresh instance each render would thrash all character consumers.
 *
 * @param props.children - The app subtree; every character consumer must be inside it.
 */
export function ActiveCharacterStoreProvider({ children }: { children: ReactNode }) {
   const activeTabId = useTabManagerStore((state) => state.activeTabId);
   const activeTabType = useTabManagerStore(
      (state) => state.openTabs.find((tab) => tab.id === state.activeTabId)?.type ?? null,
   );

   const activeStore = useMemo(
      () =>
         activeTabId === null || activeTabType !== 'character'
            ? getMenuFallbackInstance()
            : getOrCreateInstance(activeTabId),
      [activeTabId, activeTabType],
   );

   return (
      <ActiveCharacterStoreContext.Provider value={activeStore}>
         {children}
      </ActiveCharacterStoreContext.Provider>
   );
}
