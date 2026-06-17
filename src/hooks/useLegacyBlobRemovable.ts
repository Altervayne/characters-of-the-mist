// -- React Imports --
import { useCallback, useEffect, useState } from 'react';

/**
 * Whether a legacy backup blob may be offered for removal in settings, generic
 * over the data domain (drawer, character, etc.).
 *
 * Calls the supplied `getRemovalState` on mount: the cleanup action is shown only
 * when that domain reports `removable` (the blob is present AND the migration was
 * verified faithful at migration time). `refresh` re-checks (call it after a
 * successful removal so the action hides). Returns `removable: false` until the
 * async check resolves, so the action never flashes before the gate is confirmed.
 *
 * `getRemovalState` MUST be a stable reference (e.g. a module-level function); an
 * inline closure would re-run the effect on every render.
 *
 * @param getRemovalState - Domain-specific async check returning `{ removable }`.
 * @returns `{ removable, refresh }`.
 */
export function useLegacyBlobRemovable(getRemovalState: () => Promise<{ removable: boolean }>) {
   const [removable, setRemovable] = useState(false);

   const refresh = useCallback(() => {
      void getRemovalState().then((state) => setRemovable(state.removable));
   }, [getRemovalState]);

   useEffect(() => {
      refresh();
   }, [refresh]);

   return { removable, refresh };
}
