// -- React Imports --
import { useCallback, useEffect, useState } from 'react';

// -- Drawer Data Layer Imports --
import { getLegacyBlobRemovalState } from '@/lib/drawer/runDrawerMigration';

/**
 * Whether the legacy drawer backup blob may be offered for removal in settings.
 *
 * Reads {@link getLegacyBlobRemovalState} on mount: the cleanup action is shown
 * only when the blob is present AND the migration was verified faithful at
 * migration time. `refresh` re-checks (call it after a successful removal so the
 * action hides). Returns `removable: false` until the async check resolves, so the
 * action never flashes before the gate is confirmed.
 *
 * @returns `{ removable, refresh }`.
 */
export function useLegacyBlobRemovable() {
   const [removable, setRemovable] = useState(false);

   const refresh = useCallback(() => {
      void getLegacyBlobRemovalState().then((state) => setRemovable(state.removable));
   }, []);

   useEffect(() => {
      refresh();
   }, [refresh]);

   return { removable, refresh };
}
