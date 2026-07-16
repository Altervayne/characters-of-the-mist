// -- Icon Imports --
import { Compass } from 'lucide-react';

// -- Type Imports --
import type { TutorialDefinition } from '../tutorialTypes';

/**
 * D1 - Full App Navigation. The orientation arc, trimmed from the old desktop tour: welcome, the
 * sidebar, the tab strip, the play area, the drawer toggle, settings, the command palette, and a
 * wrap. Every beat sits on always-present desktop chrome, so no step needs a drive. Step copy is
 * ported from the existing `Tutorial.*` keys; a missing anchor degrades (skips) rather than bails.
 */
export const DESKTOP_NAVIGATION_TUTORIAL: TutorialDefinition = {
   id: 'desktop.navigation',
   platform: 'desktop',
   system: 'navigation',
   titleKey: 'TutorialsDialog.tutorials.navigation.title',
   teachKey: 'TutorialsDialog.tutorials.navigation.teach',
   icon: Compass,
   // Seed a demo character so the play-area beat always has a real sheet to spotlight, regardless
   // of what the user has open, and the user's own sheet is never touched.
   needsDemo: 'character',
   steps: [
      {
         id: 'welcome',
         titleKey: 'Tutorial.welcome_title',
         bodyKey: 'Tutorial.welcome_content',
         placement: 'center',
         advance: { on: 'next-click' },
      },
      {
         id: 'sidebar',
         anchorKey: 'sidebar-menu',
         titleKey: 'Tutorial.sidebar_title',
         bodyKey: 'Tutorial.sidebar_content',
         placement: 'right',
         advance: { on: 'next-click' },
      },
      {
         id: 'tab-strip',
         anchorKey: 'tab-strip',
         titleKey: 'Tutorial.tabStrip_title',
         bodyKey: 'Tutorial.tabStrip_content',
         placement: 'bottom',
         advance: { on: 'next-click' },
      },
      {
         id: 'play-area',
         anchorKey: 'character-sheet',
         titleKey: 'Tutorial.playArea_title',
         bodyKey: 'Tutorial.playArea_content',
         placement: 'top',
         advance: { on: 'next-click' },
      },
      {
         id: 'drawer-toggle',
         anchorKey: 'drawer-toggle',
         titleKey: 'Tutorial.menuDrawer_title',
         bodyKey: 'Tutorial.menuDrawer_content',
         placement: 'right',
         advance: { on: 'next-click' },
      },
      {
         id: 'settings',
         anchorKey: 'settings-button',
         titleKey: 'Tutorial.settings_title',
         bodyKey: 'Tutorial.settings_content',
         placement: 'right',
         advance: { on: 'next-click' },
      },
      {
         id: 'command-palette',
         titleKey: 'Tutorial.commandPalette_title',
         bodyKey: 'Tutorial.commandPalette_content',
         placement: 'center',
         advance: { on: 'next-click' },
      },
      {
         id: 'wrap',
         titleKey: 'Tutorial.closingWords_title',
         bodyKey: 'Tutorial.closingWords_content',
         placement: 'center',
         advance: { on: 'next-click' },
      },
   ],
};
