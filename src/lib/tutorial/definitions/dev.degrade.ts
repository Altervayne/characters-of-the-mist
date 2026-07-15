// -- Type Imports --
import type { TutorialDefinition } from '../tutorialTypes';

/**
 * A throwaway definition exercising the anchor-degradation policy: a resolvable step, a
 * non-required missing anchor (skips + auto-advances), a resolvable step (resets the miss
 * streak), a required missing anchor (centered spotlight-less tooltip), then a missing
 * anchor that trips the two-consecutive-miss bail. Dev-only, registered beside the probe;
 * filtered out of the platform selector by its `dev.` id.
 */
export const DEV_DEGRADE_TUTORIAL: TutorialDefinition = {
   id: 'dev.degrade',
   platform: 'desktop',
   system: 'navigation',
   titleKey: 'Tutorial.welcome_title',
   teachKey: 'Tutorial.welcome_content',
   steps: [
      { id: 'resolve-a', anchorKey: 'dev.gated', titleKey: 'Tutorial.welcome_title', bodyKey: 'Tutorial.welcome_content', interaction: 'blocked', advance: { on: 'next-click' } },
      { id: 'skip-nonreq', anchorKey: 'dev.missing-1', required: false, titleKey: 'Tutorial.trackers_title', bodyKey: 'Tutorial.trackers_content', advance: { on: 'next-click' } },
      { id: 'resolve-b', anchorKey: 'dev.gated', titleKey: 'Tutorial.cards_title', bodyKey: 'Tutorial.cards_content', interaction: 'blocked', advance: { on: 'next-click' } },
      { id: 'required-centered', anchorKey: 'dev.missing-2', required: true, titleKey: 'Tutorial.sidebar_title', bodyKey: 'Tutorial.sidebar_content', advance: { on: 'next-click' } },
      { id: 'bail-miss', anchorKey: 'dev.missing-3', required: false, titleKey: 'Tutorial.playArea_title', bodyKey: 'Tutorial.playArea_content', advance: { on: 'next-click' } },
   ],
};
