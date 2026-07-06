// -- React Imports --
import { useMemo, type ReactNode } from 'react';

// -- Local Imports --
import { ActiveNoteStoreContext } from './ActiveNoteStoreContext';
import { getOrCreateNoteInstance } from './noteStoreRegistry';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

/*
 * Provider for {@link ActiveNoteStoreContext}. Kept in its own component-only file so the
 * context object and the resolving hook can live in a plain `.ts` module (mirrors the board
 * provider).
 */

/**
 * Provides the ACTIVE note store instance to its subtree, following the TabManager's
 * `activeTabId`: the instance for the active tab when that tab is a note, else `null`
 * (a character/board tab or the menu). The value is memoized on the active id + type so
 * its reference is stable per active note.
 *
 * @param props.children - The app subtree; every note consumer must be inside it.
 */
export function ActiveNoteStoreProvider({ children }: { children: ReactNode }) {
   const activeTabId = useTabManagerStore((state) => state.activeTabId);
   const activeTabType = useTabManagerStore(
      (state) => state.openTabs.find((tab) => tab.id === state.activeTabId)?.type ?? null,
   );

   const activeStore = useMemo(
      () => (activeTabId !== null && activeTabType === 'note' ? getOrCreateNoteInstance(activeTabId) : null),
      [activeTabId, activeTabType],
   );

   return <ActiveNoteStoreContext.Provider value={activeStore}>{children}</ActiveNoteStoreContext.Provider>;
}
