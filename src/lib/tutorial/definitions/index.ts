// -- Definition Imports --
import { DEV_PROOF_TUTORIAL } from './dev.proof';
import { DEV_DEGRADE_TUTORIAL } from './dev.degrade';

// -- Type Imports --
import type { TutorialDefinition, TutorialPlatform } from '../tutorialTypes';

/**
 * Every tutorial keyed by id. Authored as data (one file per tutorial), aggregated here.
 * The real tutorials land in later phases; for now this holds only the throwaway `dev.`
 * proof/degradation scenarios.
 */
export const TUTORIALS: Record<string, TutorialDefinition> = {
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
