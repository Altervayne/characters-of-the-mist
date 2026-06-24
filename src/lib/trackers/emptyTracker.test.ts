import { describe, expect, it } from 'vitest';

import { emptyTracker } from './emptyTracker';

/*
 * The fresh-tracker factory: each type's shape, game-free, with fresh ids.
 */

describe('emptyTracker', () => {
   it('builds a blank STATUS with six unfilled tiers and no game', () => {
      const status = emptyTracker('STATUS');
      expect(status).toMatchObject({ name: '', trackerType: 'STATUS', tiers: [false, false, false, false, false, false] });
      expect(status).not.toHaveProperty('game');
      expect(status.id).toBeTruthy();
   });

   it('builds a blank STORY_TAG, unscratched and game-free', () => {
      const tag = emptyTracker('STORY_TAG');
      expect(tag).toMatchObject({ name: '', trackerType: 'STORY_TAG', isScratched: false });
      expect(tag).not.toHaveProperty('game');
      expect(tag.id).toBeTruthy();
   });

   it('builds a blank STORY_THEME with an empty main tag and empty tag lists, game-free', () => {
      const theme = emptyTracker('STORY_THEME');
      expect(theme).toMatchObject({
         name: '',
         trackerType: 'STORY_THEME',
         mainTag: { name: '', isActive: false, isScratched: false },
         powerTags: [],
         weaknessTags: [],
      });
      expect(theme).not.toHaveProperty('game');
      expect(theme.id).toBeTruthy();
      expect(theme.mainTag.id).toBeTruthy();
   });

   it('mints fresh ids on every call', () => {
      const a = emptyTracker('STATUS');
      const b = emptyTracker('STATUS');
      expect(a.id).not.toBe(b.id);
   });
});
