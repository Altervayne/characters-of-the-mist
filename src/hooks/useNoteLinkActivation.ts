// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import toast from 'react-hot-toast';

// -- Portals Imports --
import { parseLinkHref, resolveLinkAction } from '@/lib/portals/linkTarget';
import { runLinkAction } from '@/lib/portals/runLinkAction';
import { openEntityTab } from '@/lib/portals/openEntityTab';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { NoteHostContext } from '@/lib/portals/linkTarget';

/*
 * The note-link click bridge shared by every render surface (the tab's Reading + Live editor, and the board
 * note tile): given the surface's host context and its section-scroll, it returns one `onLinkActivate(href)`
 * that classifies -> resolves -> dispatches. Keeping it here means the two render sites can't drift on how a
 * link behaves, only on WHICH host they stamp and HOW they scroll a same-note section.
 */

/**
 * Builds the link-activation handler for a note render surface.
 * @param host           The render host (a tab, or a board embed) - decides the context-dependent element action.
 * @param scrollToSection How this surface scrolls to a same-note `#slug` (a dead slug is a no-op).
 */
export function useNoteLinkActivation(host: NoteHostContext, scrollToSection: (slug: string) => void): (href: string) => void {
   const { t } = useTranslation();
   const actions = useTabManagerActions();

   return useCallback(
      (href: string) => {
         const action = resolveLinkAction(parseLinkHref(href), host);
         runLinkAction(action, {
            openEntityTab: (entity, id) => openEntityTab(entity, id, { actions, onMissing: () => toast.error(t('Notifications.link.targetNotFound')) }),
            scrollToSection,
            notifyDeferred: (deferred) => toast(t(deferred === 'spawn-on-board' ? 'Notifications.link.spawnOnBoardSoon' : 'Notifications.link.revealInDrawerSoon')),
         });
      },
      [host, scrollToSection, actions, t],
   );
}
