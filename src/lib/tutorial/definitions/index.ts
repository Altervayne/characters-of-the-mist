// -- Definition Imports --
import { DESKTOP_NAVIGATION_TUTORIAL } from './desktop.navigation';
import { DESKTOP_SHEET_TUTORIAL } from './desktop.sheet';
import { DESKTOP_BOARD_TUTORIAL } from './desktop.board';
import { DESKTOP_NOTES_TUTORIAL } from './desktop.notes';
import { DESKTOP_PORTALS_TUTORIAL } from './desktop.portals';

// -- Type Imports --
import type { TutorialDefinition, TutorialPlatform } from '../tutorialTypes';

/**
 * Every tutorial keyed by id. Authored as data (one file per tutorial), aggregated here.
 */
export const TUTORIALS: Record<string, TutorialDefinition> = {
   [DESKTOP_NAVIGATION_TUTORIAL.id]: DESKTOP_NAVIGATION_TUTORIAL,
   [DESKTOP_SHEET_TUTORIAL.id]: DESKTOP_SHEET_TUTORIAL,
   [DESKTOP_BOARD_TUTORIAL.id]: DESKTOP_BOARD_TUTORIAL,
   [DESKTOP_NOTES_TUTORIAL.id]: DESKTOP_NOTES_TUTORIAL,
   [DESKTOP_PORTALS_TUTORIAL.id]: DESKTOP_PORTALS_TUTORIAL,
};

/** Looks up a definition by id. */
export function getTutorialDefinition(id: string): TutorialDefinition | null {
   return TUTORIALS[id] ?? null;
}

/** The tutorials to offer on a platform, feeding the list and the first-run trigger. */
export function getTutorialsForPlatform(platform: TutorialPlatform): TutorialDefinition[] {
   return Object.values(TUTORIALS).filter((definition) => definition.platform === platform);
}
