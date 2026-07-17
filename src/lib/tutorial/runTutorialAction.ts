// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { MobileNavAction } from '@/lib/mobile/mobileNavTypes';
import type { TutorialAction } from './tutorialTypes';

/**
 * How long a queued nav request waits for the page to consume it. A drain lands within a render cycle, so
 * this only catches the case where nothing is mounted to consume the queue at all - a desktop run, or a
 * teardown that unmounts the page mid-drive - where waiting forever would freeze the run. Kept well under
 * `ANCHOR_TIMEOUT_MS` so a drive that gives up still settles into the runner's own missing-anchor path
 * rather than deadlocking ahead of it.
 */
const MOBILE_NAV_DRAIN_TIMEOUT_MS = 1000;

/**
 * Queues a nav request and resolves once the page has drained the queue against its own setters. The page
 * consumes from an effect, so a caller that only fired and forgot would run on and read the DOM a commit
 * early - measuring a control that is still mid-exit, or binding a gate to a node that is about to be
 * replaced. Settles exactly once: on the drain, or on the timeout when nothing consumes it.
 */
function dispatchMobileNav(action: MobileNavAction): Promise<void> {
   useAppGeneralStateStore.getState().actions.requestMobileNavAction(action);
   return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
         if (settled) return;
         settled = true;
         unsubscribe();
         clearTimeout(timer);
         resolve();
      };

      const unsubscribe = useAppGeneralStateStore.subscribe((state) => {
         if (state.pendingMobileNavActions.length === 0) finish();
      });
      const timer = setTimeout(finish, MOBILE_NAV_DRAIN_TIMEOUT_MS);

      // The page may have drained between the request and the subscribe; re-check.
      if (useAppGeneralStateStore.getState().pendingMobileNavActions.length === 0) finish();
   });
}

/**
 * The one seam that knows how to talk to the stores. Switches on the descriptor's `type`
 * and calls each store action read FRESH at dispatch (never a captured setter), mirroring
 * the board-action bridge. Tab opens and mobile nav drives return a Promise the runner awaits
 * before it anchors. Every verb is idempotent and writes no new record - the engine performs
 * zero repository writes against real stores.
 */
export function runTutorialAction(action: TutorialAction): void | Promise<void> {
   const general = useAppGeneralStateStore.getState().actions;
   const settings = useAppSettingsStore.getState().actions;
   const tabs = useTabManagerStore.getState().actions;

   switch (action.type) {
      case 'openBoardTab':
         return tabs.openBoardTab(action.boardId);
      case 'openNoteTab':
         return tabs.openNoteTab(action.noteId);
      case 'setActiveTab':
         tabs.setActiveTab(action.tabId);
         return;
      case 'deactivateToMenu':
         tabs.deactivate();
         return;
      case 'setEditing':
         general.setIsEditing(action.value);
         return;
      case 'setDrawer':
         if (action.mode === 'closed') {
            general.setDrawerOpen(false);
         } else if (action.mode === 'expanded') {
            general.expandDrawer();
         } else {
            general.setDrawerOpen(true);
            general.setDrawerExpanded(false);
         }
         return;
      case 'setNavigator':
         settings.setNavigatorOpen(action.open);
         return;
      case 'setLayersPanel':
         settings.setLayersPanelOpen(action.open);
         return;
      case 'setDiceTray':
         settings.setDiceTrayOpen(action.open);
         return;
      case 'setCommandPalette':
         general.setCommandPaletteOpen(action.open);
         return;
      case 'openSettings':
         if (action.section !== undefined) general.setSettingsInitialSection(action.section);
         general.setSettingsOpen(true);
         return;
      case 'closeSettings':
         general.setSettingsOpen(false);
         return;
      case 'setSettingsSection':
         // Live-switch the OPEN hub's active section. The shell follows `settingsInitialSection`
         // reactively (not only on open), so pushing it here moves the walk from tab to tab.
         general.setSettingsInitialSection(action.section);
         return;
      case 'clearJourney':
         // Zero the portal trail so a jump gate measures a FRESH dive from this step, not one the user
         // already took from a lit earlier beat (which would leave the gate pre-satisfied on arrival).
         tabs.clearJourney();
         return;
      case 'board':
         general.requestBoardAction(action.action);
         return;
      case 'mobileNav':
         return dispatchMobileNav(action.action);
   }
}

/** Runs one action or an ordered list, awaiting each (so async tab opens finish first). */
export async function runTutorialActions(actions: TutorialAction | TutorialAction[] | undefined): Promise<void> {
   if (!actions) return;
   const list = Array.isArray(actions) ? actions : [actions];
   for (const action of list) {
      await runTutorialAction(action);
   }
}
