// -- Type Imports --
import type { TutorialPlatform, TutorialPlacement } from './tutorialTypes';

/**
 * Per-platform runner tuning. One runner, two profiles resolved by device type - the
 * engine itself never branches on platform.
 */
export interface TutorialConfigProfile {
   /** Padding added around the spotlight halo. */
   haloPadding: number;
   coachMinWidth: number;
   coachMaxWidth: number;
   /** Placements the coach-mark may flip among. */
   placements: TutorialPlacement[];
   /** Whether the coach-mark draws a pointer at the anchor. */
   hasPointer: boolean;
}

const MOBILE_PROFILE: TutorialConfigProfile = {
   haloPadding: 8,
   coachMinWidth: 200,
   coachMaxWidth: 320,
   placements: ['top', 'bottom', 'center'],
   hasPointer: false,
};

const DESKTOP_PROFILE: TutorialConfigProfile = {
   haloPadding: 12,
   coachMinWidth: 320,
   coachMaxWidth: 360,
   placements: ['top', 'bottom', 'left', 'right', 'center'],
   hasPointer: true,
};

export function getTutorialProfile(platform: TutorialPlatform): TutorialConfigProfile {
   return platform === 'mobile' ? MOBILE_PROFILE : DESKTOP_PROFILE;
}
