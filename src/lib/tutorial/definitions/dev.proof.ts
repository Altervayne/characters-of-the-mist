// -- Type Imports --
import type { TutorialDefinition } from '../tutorialTypes';

/**
 * A throwaway two-step definition that exercises the engine end to end: a DRIVEN step that
 * awaits an async drive (opening the settings hub) before anchoring on a marker that mounts
 * only once that surface exists, then a GATED step whose `anchor-only` cutout lets the real
 * click land. Both drives are idempotent and write no record. Registered only alongside the
 * dev-only probe (`TutorialDevProbe`); filtered out of the platform selector by its `dev.` id.
 */
export const DEV_PROOF_TUTORIAL: TutorialDefinition = {
   id: 'dev.proof',
   platform: 'desktop',
   system: 'navigation',
   titleKey: 'Tutorial.welcome_title',
   teachKey: 'Tutorial.welcome_content',
   steps: [
      {
         id: 'driven',
         onArrive: { type: 'openSettings', section: 'appearance' },
         onLeave: { type: 'closeSettings' },
         anchorKey: 'dev.driven',
         titleKey: 'Tutorial.welcome_title',
         bodyKey: 'Tutorial.welcome_content',
         placement: 'left',
         interaction: 'blocked',
         advance: { on: 'next-click' },
      },
      {
         id: 'gated',
         anchorKey: 'dev.gated',
         titleKey: 'Tutorial.trackers_title',
         bodyKey: 'Tutorial.trackers_content',
         placement: 'top',
         interaction: 'anchor-only',
         advance: { on: 'user-action', signal: { kind: 'dom-event', event: 'click' } },
      },
   ],
};
