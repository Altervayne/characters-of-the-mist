// -- React Imports --
import { useMemo, type ReactNode } from 'react';

// -- Local Imports --
import { ActiveCharacterStoreContext } from './ActiveCharacterStoreContext';
import { getMenuFallbackInstance, getOrCreateInstance } from './characterStoreRegistry';
import { useTabManagerStore } from './tabManagerStore';

/*
 * Provider for {@link ActiveCharacterStoreContext}. Kept in its own component-only
 * file so the context object and the resolving hook can live in a plain `.ts`
 * module (tabs spec §1.2); this separation keeps `react-refresh/only-export-components`
 * happy without changing any consumer import.
 */

/**
 * Provides the ACTIVE character store instance to its subtree, following the
 * TabManager's `activeTabId` (tabs spec §1.2, §2): the instance for the active tab,
 * or the permanent menu fallback instance when no character tab is open. The value
 * is memoized on `activeTabId` so its reference is stable per active id, supplying
 * a fresh instance each render would thrash all character consumers.
 *
 * @param props.children - The app subtree; every character consumer must be inside it.
 */
export function ActiveCharacterStoreProvider({ children }: { children: ReactNode }) {
   const activeTabId = useTabManagerStore((state) => state.activeTabId);

   const activeStore = useMemo(
      () => (activeTabId === null ? getMenuFallbackInstance() : getOrCreateInstance(activeTabId)),
      [activeTabId],
   );

   return (
      <ActiveCharacterStoreContext.Provider value={activeStore}>
         {children}
      </ActiveCharacterStoreContext.Provider>
   );
}
