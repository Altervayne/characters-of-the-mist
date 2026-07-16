// -- Definition Imports --
import { DESKTOP_NAVIGATION_TUTORIAL } from './desktop.navigation';
import { DESKTOP_SHEET_TUTORIAL } from './desktop.sheet';
import { DEV_PROOF_TUTORIAL } from './dev.proof';
import { DEV_DEGRADE_TUTORIAL } from './dev.degrade';

// -- Type Imports --
import type { TutorialDefinition, TutorialPlatform } from '../tutorialTypes';

/**
 * Every tutorial keyed by id. Authored as data (one file per tutorial), aggregated here.
 * Real tutorials sit alongside the throwaway `dev.` proof/degradation scenarios, which the
 * platform selector filters out of the user-facing surfaces.
 */
export const TUTORIALS: Record<string, TutorialDefinition> = {
   [DESKTOP_NAVIGATION_TUTORIAL.id]: DESKTOP_NAVIGATION_TUTORIAL,
   [DESKTOP_SHEET_TUTORIAL.id]: DESKTOP_SHEET_TUTORIAL,
   [DEV_PROOF_TUTORIAL.id]: DEV_PROOF_TUTORIAL,
   [DEV_DEGRADE_TUTORIAL.id]: DEV_DEGRADE_TUTORIAL,
};

/** Looks up a definition by id. */
export function getTutorialDefinition(id: string): TutorialDefinition | null {
   return TUTORIALS[id] ?? null;
}

/**
 * The tutorials to offer on a platform, feeding the list and the first-run trigger.
 * `dev.` ids are internal proof/scaffolding, hidden unless `includeDev` is set - the list and picker pass
 * `import.meta.env.DEV` so the throwaway scenarios are exercisable in dev while prod stays clean of them.
 */
export function getTutorialsForPlatform(
   platform: TutorialPlatform,
   options?: { includeDev?: boolean },
): TutorialDefinition[] {
   const includeDev = options?.includeDev ?? false;
   return Object.values(TUTORIALS).filter(
      (definition) => definition.platform === platform && (includeDev || !definition.id.startsWith('dev.')),
   );
}
