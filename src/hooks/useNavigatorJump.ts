// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Portals Imports --
import { activateLinkTarget } from '@/lib/portals/activateLinkTarget';
import { getCachedLinkMetadata } from '@/lib/portals/linkMetadata';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { NavNode } from '@/lib/navigator/navigatorGraph';

/*
 * The Navigator jump bridge: the tab-host consumer of the shared {@link activateLinkTarget} core, sibling to the
 * board portal's `usePortalActivation`. It stamps a `tab` host (the Navigator is not on a board), so an entity
 * opens/focuses its tab, an element reveals in the drawer (no spawn-beside - there is no board to spawn onto),
 * and an external opens its URL. Because both surfaces share one core, a Navigator jump and a canvas-portal jump
 * build the SAME breadcrumb trail. A "seen above" back-edge still jumps - the cycle mark suppresses only
 * expansion, never the jump; a dead target toasts and pushes no edge; a self-edge (jumping to the active tab)
 * focuses it but pushes nothing. The crumb name prefers the edge caption, else the row's already-resolved name.
 */

/** Returns the double-click jump handler shared by every Navigator row. */
export function useNavigatorJump(): (node: NavNode) => void {
   const { t } = useTranslation();
   const actions = useTabManagerActions();

   return useCallback(
      (node: NavNode) => {
         activateLinkTarget(node.target, {
            host: { kind: 'tab' },
            actions,
            t,
            originItemId: node.instanceId,
            toName: node.label ?? getCachedLinkMetadata(node.target)?.displayName,
         });
      },
      [actions, t],
   );
}
