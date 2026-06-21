// -- React Imports --
import { useMemo, type ReactNode } from 'react';

// -- Local Imports --
import { ActiveBoardStoreContext } from './ActiveBoardStoreContext';
import { getOrCreateBoardInstance } from './boardStoreRegistry';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

/*
 * Provider for {@link ActiveBoardStoreContext}. Kept in its own component-only file so
 * the context object and the resolving hook can live in a plain `.ts` module.
 */

/**
 * Provides the ACTIVE board store instance to its subtree, following the TabManager's
 * `activeTabId`: the instance for the active tab when that tab is a board, else `null`
 * (a character tab or the menu). The value is memoized on the active id + type so its
 * reference is stable per active board. Inert until a board tab is opened (board-5).
 *
 * @param props.children - The app subtree; every board consumer must be inside it.
 */
export function ActiveBoardStoreProvider({ children }: { children: ReactNode }) {
   const activeTabId = useTabManagerStore((state) => state.activeTabId);
   const activeTabType = useTabManagerStore(
      (state) => state.openTabs.find((tab) => tab.id === state.activeTabId)?.type ?? null,
   );

   const activeStore = useMemo(
      () => (activeTabId !== null && activeTabType === 'board' ? getOrCreateBoardInstance(activeTabId) : null),
      [activeTabId, activeTabType],
   );

   return <ActiveBoardStoreContext.Provider value={activeStore}>{children}</ActiveBoardStoreContext.Provider>;
}
