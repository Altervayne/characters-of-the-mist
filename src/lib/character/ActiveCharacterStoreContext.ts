// -- React Imports --
import { createContext, useContext } from 'react';

// -- Type Imports --
import type { CharacterStore } from '@/lib/stores/characterStore';

/*
 * React Context carrying the ACTIVE character store instance to the sheet subtree
 * (tabs spec §1.2). The three resolving hooks (`useCharacterStore`,
 * `useCharacterActions`, `useCharacterTemporalStore`) read the active instance from
 * here, so the ~36 leaf consumers never learn that tabs exist.
 *
 * Phase 1: the provider value is the one instance, constant for the app's lifetime.
 * Phase 2 makes the value follow the active tab — every consumer re-resolves through
 * this same context with no further change.
 *
 * The context + hook live in this `.ts` file (no component export) so the
 * provider, which is a component, can live in its own `.tsx` without tripping
 * `react-refresh/only-export-components`.
 */

/** Holds the active instance, or `null` before a provider supplies one. */
export const ActiveCharacterStoreContext = createContext<CharacterStore | null>(null);

/**
 * Resolves the active character store instance from context. Throws if used outside
 * an `ActiveCharacterStoreProvider` (a developer error) so the resolving hooks can
 * rely on a non-null instance.
 *
 * @returns The active store instance.
 */
export function useActiveCharacterInstance(): CharacterStore {
   const instance = useContext(ActiveCharacterStoreContext);
   if (!instance) {
      throw new Error(
         'useActiveCharacterInstance must be used within an ActiveCharacterStoreProvider that holds an active character store.',
      );
   }
   return instance;
}
