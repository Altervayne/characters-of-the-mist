// -- Definition Imports --
import { DESKTOP_NAVIGATION_TUTORIAL } from './desktop.navigation';
import { DESKTOP_SHEET_TUTORIAL } from './desktop.sheet';
import { DESKTOP_BOARD_TUTORIAL } from './desktop.board';
import { DESKTOP_NOTES_TUTORIAL } from './desktop.notes';
import { DESKTOP_PORTALS_TUTORIAL } from './desktop.portals';
import { DESKTOP_DRAWER_TUTORIAL } from './desktop.drawer';
import { DESKTOP_THEMES_TUTORIAL } from './desktop.themes';
import { DESKTOP_COMMAND_PALETTE_TUTORIAL } from './desktop.commandPalette';
import { MOBILE_NAV_TUTORIAL } from './mobile.nav';
import { MOBILE_SHEET_TUTORIAL } from './mobile.sheet';
import { MOBILE_DRAWER_TUTORIAL } from './mobile.drawer';

// -- Type Imports --
import type { TutorialDefinition, TutorialPlatform } from '../tutorialTypes';

/**
 * Every tutorial keyed by id. Authored as data (one file per tutorial), aggregated here. Insertion order is
 * the order each platform's list offers them, so each platform's run reads from the layout inward: where
 * things live, then the surfaces themselves.
 */
export const TUTORIALS: Record<string, TutorialDefinition> = {
   [DESKTOP_NAVIGATION_TUTORIAL.id]: DESKTOP_NAVIGATION_TUTORIAL,
   [DESKTOP_SHEET_TUTORIAL.id]: DESKTOP_SHEET_TUTORIAL,
   [DESKTOP_BOARD_TUTORIAL.id]: DESKTOP_BOARD_TUTORIAL,
   [DESKTOP_NOTES_TUTORIAL.id]: DESKTOP_NOTES_TUTORIAL,
   [DESKTOP_PORTALS_TUTORIAL.id]: DESKTOP_PORTALS_TUTORIAL,
   [DESKTOP_DRAWER_TUTORIAL.id]: DESKTOP_DRAWER_TUTORIAL,
   [DESKTOP_THEMES_TUTORIAL.id]: DESKTOP_THEMES_TUTORIAL,
   [DESKTOP_COMMAND_PALETTE_TUTORIAL.id]: DESKTOP_COMMAND_PALETTE_TUTORIAL,
   [MOBILE_NAV_TUTORIAL.id]: MOBILE_NAV_TUTORIAL,
   [MOBILE_SHEET_TUTORIAL.id]: MOBILE_SHEET_TUTORIAL,
   [MOBILE_DRAWER_TUTORIAL.id]: MOBILE_DRAWER_TUTORIAL,
};

/** Looks up a definition by id. */
export function getTutorialDefinition(id: string): TutorialDefinition | null {
   return TUTORIALS[id] ?? null;
}

/** The tutorials to offer on a platform, feeding the list and the first-run trigger. */
export function getTutorialsForPlatform(platform: TutorialPlatform): TutorialDefinition[] {
   return Object.values(TUTORIALS).filter((definition) => definition.platform === platform);
}
