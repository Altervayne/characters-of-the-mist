'use client';

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Icon Imports --
import { FileUp, Pencil, Settings, PanelLeftOpen, BookOpen, FlipHorizontal, Type, Sun, Moon, Palette, Undo2, FilePlus, ListPlus } from 'lucide-react';

// -- Utils Imports --
import { exportCharacterSheet, exportDrawer } from '@/lib/utils/export-import';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useDrawerStore } from '@/lib/stores/drawerStore';



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
   action?: () => void;
   pageId?: string;
}



export function useCommandPaletteActions({ onToggleEditMode, onToggleDrawer, onOpenSettings }: CommandActionArgs): CommandAction[] {
   const { t: t } = useTranslation();
   const { t: tNotifications } = useTranslation();
   const character = useCharacterStore((state) => state.character);
   const drawer = useDrawerStore((state) => state.drawer);
   const { resetCharacter } = useCharacterActions();
   const { setSideBySideView } = useAppSettingsActions();
   const { setTheme: setMode } = useTheme();

   const handleExportCharacter = () => {
      if (!character) {
         toast.error(tNotifications('Notifications.character.exportFailedNoChar'));
         return;
      };
      exportCharacterSheet(character);
      toast.success(tNotifications('Notifications.character.exported'));
   };

   const handleExportDrawer = () => {
      exportDrawer(drawer);
      toast.success(tNotifications('Notifications.drawer.exported'));
   };

   // Determine if creation commands should be shown
   const currentGame = character?.game;
   const showCreationCommands = currentGame && currentGame !== 'NEUTRAL';

   const staticCommands: CommandAction[] = [

      // #########################
      // ###   GENERAL GROUP   ###
      // #########################
      { id: 'toggleEdit', label: `APP_EDIT | ${t('CommandPalette.commands.toggleEdit')}`, icon: Pencil, group: t('CommandPalette.groups.general'), action: onToggleEditMode },
      { id: 'toggleDrawer', label: `APP_DRAW | ${t('CommandPalette.commands.toggleDrawer')}`, icon: PanelLeftOpen, group: t('CommandPalette.groups.general'), action: onToggleDrawer },
      { id: 'openSettings', label: `APP_STNG | ${t('CommandPalette.commands.openSettings')}`, icon: Settings, group: t('CommandPalette.groups.general'), action: onOpenSettings },

      // ##########################
      // ###   SETTINGS GROUP   ###
      // ##########################
      { id: 'setThemeModeLight', label: `STNG_LIGHT | ${t('CommandPalette.commands.setThemeModeLight')}`, icon: Sun, group: t('CommandPalette.groups.settings'), action: () => setMode('light') },
      { id: 'setThemeModeDark', label: `STNG_DARK | ${t('CommandPalette.commands.setThemeModeDark')}`, icon: Moon, group: t('CommandPalette.groups.settings'), action: () => setMode('dark') },
      { id: 'setThemePalette', label: `STNG_PAL | ${t('CommandPalette.commands.setThemePalette')}`, icon: Palette, group: t('CommandPalette.groups.settings'), pageId: 'setThemePalette' },
      { id: 'viewFlipping', label: `STNG_FLIP | ${t('CommandPalette.commands.viewFlipping')}`, icon: FlipHorizontal, group: t('CommandPalette.groups.settings'), action: () => setSideBySideView(false) },
      { id: 'viewSideBySide', label: `STNG_SBS | ${t('CommandPalette.commands.viewSideBySide')}`, icon: BookOpen, group: t('CommandPalette.groups.settings'), action: () => setSideBySideView(true) },

      // ########################
      // ###   EXPORT GROUP   ###
      // ########################
      { id: 'exportCharacter', label: `EXPT_CHAR | ${t('CommandPalette.commands.exportCharacter')}`, icon: FileUp, group: t('CommandPalette.groups.export'), action: handleExportCharacter },
      { id: 'exportDrawer', label: `EXPT_DRAW | ${t('CommandPalette.commands.exportDrawer')}`, icon: FileUp, group: t('CommandPalette.groups.export'), action: handleExportDrawer },

      // #################################
      // ###   CHARACTER SHEET GROUP   ###
      // #################################
      { id: 'renameCharacter', label: `CHAR_REN | ${t('CommandPalette.commands.renameCharacter')}`, icon: Type, group: t('CommandPalette.groups.character'), pageId: 'renameCharacter' },
      { id: 'resetCharacter', label: `CHAR_RESET | ${t('CommandPalette.commands.resetCharacter')}`, icon: Undo2, group: t('CommandPalette.groups.character'), action: resetCharacter },

      // ##########################
      // ###   CREATION GROUP   ###
      // ##########################
      // Only show creation commands if the current game is not NEUTRAL
      ...(showCreationCommands ? [
         { id: 'createCard', label: `NEW_CARD | ${t('CommandPalette.commands.createCard')}`, icon: FilePlus, group: t('CommandPalette.groups.creation'), pageId: 'createCard_Type' },
         { id: 'createTracker', label: `NEW_TRCK | ${t('CommandPalette.commands.createTracker')}`, icon: ListPlus, group: t('CommandPalette.groups.creation'), pageId: 'createTracker_Type' },
      ] : []),
   ];

   return staticCommands;
};