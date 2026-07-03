

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Icon Imports --
import { FileUp, Pencil, Settings, PanelLeftOpen, BookOpen, FlipHorizontal, Type, Sun, Moon, Palette, SwatchBook, Undo2, FilePlus, ListPlus, Dices, UserPlus, LayoutGrid, X, ChevronRight, ChevronLeft } from 'lucide-react';

// -- Utils Imports --
import { exportCharacterSheet, exportDrawer } from '@/lib/utils/export-import';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useTabManagerStore, useTabManagerActions } from '@/lib/character/tabManagerStore';
import { exportEntireDrawerAsNestedTree } from '@/lib/drawer/drawerRepository';



interface CommandActionArgs {
   onToggleEditMode: () => void;
   onToggleDrawer: () => void;
   onOpenSettings: () => void;
}

export interface CommandAction {
   id: string;
   label: string;
   icon: React.ElementType;
   group: string;
   /** Hidden alias tokens cmdk matches on alongside the label (English, not user-facing). */
   keywords?: string[];
   action?: () => void;
   pageId?: string;
}

/** The workspace a command applies to. `global` shows everywhere; `character` only on a character tab. */
type CommandScope = 'global' | 'character';

type ScopedCommand = CommandAction & { scope: CommandScope };



export function useCommandPaletteActions({ onToggleEditMode, onToggleDrawer, onOpenSettings }: CommandActionArgs): CommandAction[] {
   const { t: t } = useTranslation();
   const { t: tNotifications } = useTranslation();
   const character = useCharacterStore((state) => state.character);
   const { resetCharacter } = useCharacterActions();
   const { setSideBySideView, toggleDiceTray } = useAppSettingsActions();
   const { setThemesOpen } = useAppGeneralStateActions();
   const { setTheme: setMode } = useTheme();
   const { createBoardTab, closeActiveTab, setActiveTab } = useTabManagerActions();

   const openTabs = useTabManagerStore((state) => state.openTabs);
   const activeTabId = useTabManagerStore((state) => state.activeTabId);

   // The active workspace is the active tab's kind (null active = the menu). Character-only
   // commands are offered on a character tab; a board tab and the menu get the global set.
   const activeWorkspace = openTabs.find((tab) => tab.id === activeTabId)?.type ?? 'menu';

   // Neighbour tabs of the active one, wrapping at the ends. Only used when a tab is active
   // and there's more than one, so the index is always valid.
   const activeIndex = openTabs.findIndex((tab) => tab.id === activeTabId);
   const nextTabId = openTabs.length > 0 ? openTabs[(activeIndex + 1) % openTabs.length]?.id : undefined;
   const prevTabId = openTabs.length > 0 ? openTabs[(activeIndex - 1 + openTabs.length) % openTabs.length]?.id : undefined;
   const hasActiveTab = activeTabId !== null;

   const handleExportCharacter = async () => {
      if (!character) {
         toast.error(tNotifications('Notifications.character.exportFailedNoChar'));
         return;
      };
      try {
         await exportCharacterSheet(character);
         toast.success(tNotifications('Notifications.character.exported'));
      } catch {
         toast.error(tNotifications('Notifications.general.exportError'));
      }
   };

   const handleExportDrawer = async () => {
      try {
         const drawer = await exportEntireDrawerAsNestedTree();
         await exportDrawer(drawer);
         toast.success(tNotifications('Notifications.drawer.exported'));
      } catch {
         toast.error(tNotifications('Notifications.drawer.actionFailed'));
      }
   };

   // Creation commands need a game with cards/trackers; NEUTRAL has none.
   const currentGame = character?.game;
   const showCreationCommands = currentGame && currentGame !== 'NEUTRAL';

   // Labels are clean i18n text; cmdk narrows on `keywords` (English alias tokens) too.
   const allCommands: ScopedCommand[] = [

      // #########################
      // ###   GENERAL GROUP   ###
      // #########################
      { id: 'toggleEdit', scope: 'character', label: t('CommandPalette.commands.toggleEdit'), keywords: ['edit', 'toggle'], icon: Pencil, group: t('CommandPalette.groups.general'), action: onToggleEditMode },
      { id: 'toggleDrawer', scope: 'global', label: t('CommandPalette.commands.toggleDrawer'), keywords: ['drawer', 'toggle'], icon: PanelLeftOpen, group: t('CommandPalette.groups.general'), action: onToggleDrawer },
      { id: 'openSettings', scope: 'global', label: t('CommandPalette.commands.openSettings'), keywords: ['settings', 'preferences', 'config'], icon: Settings, group: t('CommandPalette.groups.general'), action: onOpenSettings },
      { id: 'toggleDiceTray', scope: 'global', label: t('CommandPalette.commands.toggleDiceTray'), keywords: ['dice', 'roll', 'tray'], icon: Dices, group: t('CommandPalette.groups.general'), action: toggleDiceTray },

      // ######################
      // ###   TABS GROUP   ###
      // ######################
      // New character/board are always available; close/next/prev only when the tab state warrants.
      { id: 'newCharacter', scope: 'global', label: t('CommandPalette.commands.newCharacter'), keywords: ['tab', 'new', 'character', 'sheet'], icon: UserPlus, group: t('CommandPalette.groups.tabs'), pageId: 'newCharacter_Game' },
      { id: 'newBoard', scope: 'global', label: t('CommandPalette.commands.newBoard'), keywords: ['tab', 'new', 'board'], icon: LayoutGrid, group: t('CommandPalette.groups.tabs'), action: () => { void createBoardTab(); } },
      ...(hasActiveTab ? [
         { id: 'closeTab', scope: 'global' as const, label: t('CommandPalette.commands.closeTab'), keywords: ['tab', 'close'], icon: X, group: t('CommandPalette.groups.tabs'), action: closeActiveTab },
      ] : []),
      ...(hasActiveTab && openTabs.length > 1 ? [
         { id: 'nextTab', scope: 'global' as const, label: t('CommandPalette.commands.nextTab'), keywords: ['tab', 'next', 'switch'], icon: ChevronRight, group: t('CommandPalette.groups.tabs'), action: () => nextTabId && setActiveTab(nextTabId) },
         { id: 'prevTab', scope: 'global' as const, label: t('CommandPalette.commands.prevTab'), keywords: ['tab', 'previous', 'switch'], icon: ChevronLeft, group: t('CommandPalette.groups.tabs'), action: () => prevTabId && setActiveTab(prevTabId) },
      ] : []),

      // ##########################
      // ###   SETTINGS GROUP   ###
      // ##########################
      { id: 'setThemeModeLight', scope: 'global', label: t('CommandPalette.commands.setThemeModeLight'), keywords: ['light', 'mode', 'theme'], icon: Sun, group: t('CommandPalette.groups.settings'), action: () => setMode('light') },
      { id: 'setThemeModeDark', scope: 'global', label: t('CommandPalette.commands.setThemeModeDark'), keywords: ['dark', 'mode', 'theme'], icon: Moon, group: t('CommandPalette.groups.settings'), action: () => setMode('dark') },
      { id: 'setThemePalette', scope: 'global', label: t('CommandPalette.commands.setThemePalette'), keywords: ['palette', 'theme', 'color'], icon: Palette, group: t('CommandPalette.groups.settings'), pageId: 'setThemePalette' },
      { id: 'manageThemes', scope: 'global', label: t('CommandPalette.commands.manageThemes'), keywords: ['theme', 'themes', 'editor', 'manage', 'custom', 'palette'], icon: SwatchBook, group: t('CommandPalette.groups.settings'), action: () => setThemesOpen(true) },
      { id: 'viewFlipping', scope: 'character', label: t('CommandPalette.commands.viewFlipping'), keywords: ['flip', 'view', 'card'], icon: FlipHorizontal, group: t('CommandPalette.groups.settings'), action: () => setSideBySideView(false) },
      { id: 'viewSideBySide', scope: 'character', label: t('CommandPalette.commands.viewSideBySide'), keywords: ['side', 'view', 'card'], icon: BookOpen, group: t('CommandPalette.groups.settings'), action: () => setSideBySideView(true) },

      // ########################
      // ###   EXPORT GROUP   ###
      // ########################
      { id: 'exportCharacter', scope: 'character', label: t('CommandPalette.commands.exportCharacter'), keywords: ['export', 'character', 'save'], icon: FileUp, group: t('CommandPalette.groups.export'), action: handleExportCharacter },
      { id: 'exportDrawer', scope: 'global', label: t('CommandPalette.commands.exportDrawer'), keywords: ['export', 'drawer', 'save'], icon: FileUp, group: t('CommandPalette.groups.export'), action: handleExportDrawer },

      // #################################
      // ###   CHARACTER SHEET GROUP   ###
      // #################################
      { id: 'renameCharacter', scope: 'character', label: t('CommandPalette.commands.renameCharacter'), keywords: ['rename', 'character', 'name'], icon: Type, group: t('CommandPalette.groups.character'), pageId: 'renameCharacter' },
      { id: 'resetCharacter', scope: 'character', label: t('CommandPalette.commands.resetCharacter'), keywords: ['reset', 'character', 'clear'], icon: Undo2, group: t('CommandPalette.groups.character'), action: resetCharacter },

      // ##########################
      // ###   CREATION GROUP   ###
      // ##########################
      ...(showCreationCommands ? [
         { id: 'createCard', scope: 'character' as const, label: t('CommandPalette.commands.createCard'), keywords: ['create', 'new', 'card'], icon: FilePlus, group: t('CommandPalette.groups.creation'), pageId: 'createCard_Type' },
         { id: 'createTracker', scope: 'character' as const, label: t('CommandPalette.commands.createTracker'), keywords: ['create', 'new', 'tracker', 'status', 'tag'], icon: ListPlus, group: t('CommandPalette.groups.creation'), pageId: 'createTracker_Type' },
      ] : []),
   ];

   // A character tab gets everything; a board tab and the menu get only the global commands.
   return allCommands.filter((command) => command.scope === 'global' || activeWorkspace === 'character');
};