// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { TutorialAction } from './tutorialTypes';

/**
 * The one seam that knows how to talk to the stores. Switches on the descriptor's `type`
 * and calls each store action read FRESH at dispatch (never a captured setter), mirroring
 * the board-action bridge. Tab opens return a Promise the runner awaits before it anchors.
 * Every verb is idempotent and writes no new record - the engine performs zero repository
 * writes against real stores.
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
      case 'board':
         general.requestBoardAction(action.action);
         return;
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
