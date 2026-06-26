// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { itemDateMode, relativeDateLadder } from './itemDateDisplay';

/*
 * The item date rule: re-saveable types (character sheet / board) read "Updated", every other type
 * reads "Created"; the relative ladder steps now -> minutes -> hours -> days -> weeks -> absolute.
 */

describe('itemDateMode', () => {
   it('re-saveable types read "updated"', () => {
      expect(itemDateMode('FULL_CHARACTER_SHEET')).toBe('updated');
      expect(itemDateMode('FULL_BOARD')).toBe('updated');
   });

   it('every write-once type reads "created"', () => {
      for (const type of ['CHARACTER_CARD', 'CHARACTER_THEME', 'GROUP_THEME', 'STATUS_TRACKER', 'STORY_TAG_TRACKER', 'STORY_THEME_TRACKER', 'IMAGE_CARD'] as const) {
         expect(itemDateMode(type)).toBe('created');
      }
   });
});

describe('relativeDateLadder', () => {
   const MIN = 60_000;
   const HOUR = 60 * MIN;
   const DAY = 24 * HOUR;
   const WEEK = 7 * DAY;

   it('reads as "now" under a minute', () => {
      expect(relativeDateLadder(0)).toEqual({ unit: 'second', value: 0 });
      expect(relativeDateLadder(30_000)).toEqual({ unit: 'second', value: 0 });
   });

   it('steps minutes / hours / days / weeks (value negative = ago)', () => {
      expect(relativeDateLadder(5 * MIN)).toEqual({ unit: 'minute', value: -5 });
      expect(relativeDateLadder(3 * HOUR)).toEqual({ unit: 'hour', value: -3 });
      expect(relativeDateLadder(2 * DAY)).toEqual({ unit: 'day', value: -2 });
      expect(relativeDateLadder(3 * WEEK)).toEqual({ unit: 'week', value: -3 });
   });

   it('falls back to absolute past ~4 weeks', () => {
      expect(relativeDateLadder(4 * WEEK)).toEqual({ absolute: true });
      expect(relativeDateLadder(365 * DAY)).toEqual({ absolute: true });
   });

   it('clamps a future timestamp to "now"', () => {
      expect(relativeDateLadder(-10_000)).toEqual({ unit: 'second', value: 0 });
   });
});
