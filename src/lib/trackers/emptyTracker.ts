// -- Other Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { StatusTracker, StoryTagTracker, StoryThemeTracker, Tracker } from '@/lib/types/character';

/*
 * The single source for a fresh, game-agnostic tracker (a tracker carries no game - it themes from
 * its context). Shared by the character store's add* actions and the board's create-at-cursor, so a
 * tracker made on a sheet and one made on the board are byte-identical in shape.
 */

/** The tracker kind discriminator. */
export type TrackerType = Tracker['trackerType'];

export function emptyTracker(trackerType: 'STATUS'): StatusTracker;
export function emptyTracker(trackerType: 'STORY_TAG'): StoryTagTracker;
export function emptyTracker(trackerType: 'STORY_THEME'): StoryThemeTracker;
export function emptyTracker(trackerType: TrackerType): Tracker;
export function emptyTracker(trackerType: TrackerType): Tracker {
   switch (trackerType) {
      case 'STATUS':
         return { id: cuid(), name: '', trackerType: 'STATUS', tiers: Array(6).fill(false) };
      case 'STORY_TAG':
         return { id: cuid(), name: '', trackerType: 'STORY_TAG', isScratched: false };
      case 'STORY_THEME':
         return {
            id: cuid(),
            name: '',
            trackerType: 'STORY_THEME',
            mainTag: { id: cuid(), name: '', isActive: false, isScratched: false },
            powerTags: [],
            weaknessTags: [],
         };
   }
}
