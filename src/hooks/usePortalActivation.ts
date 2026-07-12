// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import toast from 'react-hot-toast';

// -- Portals Imports --
import { resolveLinkAction } from '@/lib/portals/linkTarget';
import { runLinkAction } from '@/lib/portals/runLinkAction';
import { openEntityTab } from '@/lib/portals/openEntityTab';
import { revealDrawerItem } from '@/lib/portals/revealDrawerItem';
import { portalTargetToLinkTarget } from '@/lib/portals/portalTarget';
import { spawnDrawerItemBeside } from '@/lib/board/spawnBesideItem';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { getActiveTabJourneyEntry, useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { PortalBoardContent } from '@/lib/types/board';
import type { JourneyEntry } from '@/lib/character/journey';

/*
 * The board-portal activation bridge, the portal-side sibling of `useNoteLinkActivation`. A portal wraps no
 * note, so it stamps a board-embed host WITHOUT a `noteId` and maps its structured target onto the shared
 * resolver's `LinkTarget` (no `cotm://` string round-trip), then rides the exact same resolve -> dispatch path
 * and the exact same services the note links use: `openEntityTab` (open-or-focus a tab), `spawnDrawerItemBeside`
 * (the portal IS the origin tile, reused verbatim), and the default external open. A dead target toasts via the
 * services' `onMissing`. The `board-element` variant has no 1a action, so it is a graceful no-op.
 */

// Reentrancy guard, keyed by portal item id: `openEntityTab` has a double-open race (two rapid activations both
// pass the not-open check before the first async resolve settles). The guard collapses a mashed launch glyph /
// double-activation into one open; it releases when the async open settles (or immediately for a sync action).
const inFlight = new Set<string>();

/** Builds the double-click/launch activation handler for a portal board item. */
export function usePortalActivation(itemId: string, content: PortalBoardContent): () => void {
   const { t } = useTranslation();
   const actions = useTabManagerActions();

   return useCallback(() => {
      const linkTarget = portalTargetToLinkTarget(content.target);
      if (!linkTarget) return; // board-element (same-board phase) or otherwise not activatable in 1a.
      if (inFlight.has(itemId)) return;
      inFlight.add(itemId);
      const clear = () => inFlight.delete(itemId);

      const boardId = getActiveBoardStore()?.getState().boardId ?? '';
      const action = resolveLinkAction(linkTarget, { kind: 'board-embed', boardId, itemId });
      const onMissing = () => toast.error(t('Notifications.link.targetNotFound'));

      // Portal trail: capture the origin tab SYNCHRONOUSLY (before the async open flips the active pointer) and
      // the target from the portal itself. Only an entity open is a navigation-away that records a trail edge;
      // `onNavigated` fires on `openEntityTab`'s success path (never on a dead target), keyed to the guard so a
      // double-activation is one edge. The `to` name prefers the resolved target name, else the author caption.
      const from = getActiveTabJourneyEntry();
      const to: JourneyEntry | null =
         linkTarget.kind === 'entity'
            ? { tabKind: linkTarget.entity, entityId: linkTarget.id, name: content.lastKnownName ?? content.style.label ?? '' }
            : null;
      const onNavigated = from && to && from.entityId !== to.entityId ? () => actions.pushJourney(from, to) : undefined;

      // An entity open is async (its guard releases when the promise settles); the other actions complete
      // synchronously, so they release the guard right after dispatch.
      let async = false;
      runLinkAction(action, {
         openEntityTab: (entity, id) => {
            async = true;
            return openEntityTab(entity, id, { actions, onMissing, onNavigated }).finally(clear);
         },
         scrollToSection: () => {},
         spawnBeside: (drawerItemId) => void spawnDrawerItemBeside(drawerItemId, itemId, onMissing),
         revealInDrawer: (drawerItemId) => void revealDrawerItem(drawerItemId, { onMissing }),
      });
      if (!async) clear();
   }, [itemId, content.target, content.lastKnownName, content.style.label, actions, t]);
}
