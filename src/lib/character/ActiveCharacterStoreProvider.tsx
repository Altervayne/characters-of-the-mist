// -- React Imports --
import { type ReactNode } from 'react';

// -- Local Imports --
import { ActiveCharacterStoreContext } from './ActiveCharacterStoreContext';
import { ensureSingleActiveInstance } from './characterStoreRegistry';

/*
 * Provider for {@link ActiveCharacterStoreContext}. Kept in its own component-only
 * file so the context object and the resolving hook can live in a plain `.ts`
 * module (tabs spec §1.2); this separation keeps `react-refresh/only-export-components`
 * happy without changing any consumer import.
 */

/**
 * Provides the active character store instance to its subtree. In Phase 1 it ensures
 * the single instance exists and supplies it as a stable value (the registry returns
 * the same instance on every render, so the context value reference never churns).
 * Phase 2 makes the value follow the active tab.
 *
 * @param props.children - The sheet subtree (every character consumer must be inside it).
 */
export function ActiveCharacterStoreProvider({ children }: { children: ReactNode }) {
   const activeStore = ensureSingleActiveInstance();
   return (
      <ActiveCharacterStoreContext.Provider value={activeStore}>
         {children}
      </ActiveCharacterStoreContext.Provider>
   );
}
