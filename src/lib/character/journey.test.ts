import { describe, expect, it } from 'vitest';

import {
   EMPTY_JOURNEY,
   deriveCurrentIndex,
   dropJourneyEntry,
   goToJourneyIndex,
   journeyBack,
   journeyForward,
   pushJourney,
   rekeyJourneyEntity,
   type JourneyEntry,
   type JourneySlice,
} from './journey';

/** A test entry keyed by id; the name mirrors the id for readability. */
function entry(id: string, tabKind: JourneyEntry['tabKind'] = 'board'): JourneyEntry {
   return { tabKind, entityId: id, name: id };
}

/** Builds a slice from a list of ids and a marker index. */
function slice(ids: string[], currentIndex: number): JourneySlice {
   return { entries: ids.map((id) => entry(id)), currentIndex };
}

/** The ids of a slice, for compact assertions. */
function ids(s: JourneySlice): string[] {
   return s.entries.map((e) => e.entityId);
}

describe('pushJourney', () => {
   it('seeds [from, to] on an empty trail, marker on top', () => {
      const next = pushJourney(EMPTY_JOURNEY, entry('A'), entry('B'));
      expect(ids(next)).toEqual(['A', 'B']);
      expect(next.currentIndex).toBe(1);
   });

   it('appends when the marker entry is the origin', () => {
      const next = pushJourney(slice(['A', 'B'], 1), entry('B'), entry('C'));
      expect(ids(next)).toEqual(['A', 'B', 'C']);
      expect(next.currentIndex).toBe(2);
   });

   it('truncates forward history before appending', () => {
      // Marker parked at B (index 1) with C ahead; a fresh follow to D discards C.
      const next = pushJourney(slice(['A', 'B', 'C'], 1), entry('B'), entry('D'));
      expect(ids(next)).toEqual(['A', 'B', 'D']);
      expect(next.currentIndex).toBe(2);
   });

   it('re-seeds when the origin is not the marker entry (portalled from off the marker)', () => {
      const next = pushJourney(slice(['A', 'B', 'C'], 2), entry('X'), entry('Y'));
      expect(ids(next)).toEqual(['X', 'Y']);
      expect(next.currentIndex).toBe(1);
   });

   it('guards a self-edge (from === to) as a no-op', () => {
      const start = slice(['A', 'B'], 1);
      const next = pushJourney(start, entry('B'), entry('B'));
      expect(next).toBe(start);
   });

   it('allows repeats: A -> B -> A yields [A, B, A]', () => {
      let s = pushJourney(EMPTY_JOURNEY, entry('A'), entry('B'));
      s = pushJourney(s, entry('B'), entry('A'));
      expect(ids(s)).toEqual(['A', 'B', 'A']);
      expect(s.currentIndex).toBe(2);
   });
});

describe('goToJourneyIndex / journeyBack / journeyForward (clamping)', () => {
   it('returns the entry at a clamped index and moves the marker', () => {
      const move = goToJourneyIndex(slice(['A', 'B', 'C'], 2), 0);
      expect(move.entry?.entityId).toBe('A');
      expect(move.slice.currentIndex).toBe(0);
   });

   it('clamps an out-of-range jump into the valid range', () => {
      expect(goToJourneyIndex(slice(['A', 'B'], 0), 9).slice.currentIndex).toBe(1);
      expect(goToJourneyIndex(slice(['A', 'B'], 1), -9).slice.currentIndex).toBe(0);
   });

   it('no-ops on an empty trail', () => {
      const move = goToJourneyIndex(EMPTY_JOURNEY, 0);
      expect(move.entry).toBeNull();
      expect(move.slice).toBe(EMPTY_JOURNEY);
   });

   it('steps back and clamps at the origin', () => {
      let move = journeyBack(slice(['A', 'B', 'C'], 2));
      expect(move.entry?.entityId).toBe('B');
      expect(move.slice.currentIndex).toBe(1);
      move = journeyBack(move.slice);
      expect(move.slice.currentIndex).toBe(0);
      move = journeyBack(move.slice); // already at the origin: clamped
      expect(move.slice.currentIndex).toBe(0);
   });

   it('steps forward and clamps at the top', () => {
      let move = journeyForward(slice(['A', 'B', 'C'], 0));
      expect(move.entry?.entityId).toBe('B');
      expect(move.slice.currentIndex).toBe(1);
      move = journeyForward(move.slice);
      expect(move.slice.currentIndex).toBe(2);
      move = journeyForward(move.slice); // already on top: clamped
      expect(move.slice.currentIndex).toBe(2);
   });
});

describe('dropJourneyEntry (detect-at-pop)', () => {
   it('keeps the marker on a surviving entry past the dropped one', () => {
      // Marker at C (2); B (1) is dropped. C survives, so the marker follows it to its new index 1.
      const next = dropJourneyEntry(slice(['A', 'B', 'C'], 2), 'B');
      expect(ids(next)).toEqual(['A', 'C']);
      expect(next.currentIndex).toBe(1);
   });

   it('repoints the marker back to the prior survivor when the marker sits on the dead entry (detect-at-pop)', () => {
      // Back stepped the marker onto B (1); B is dead, so the drop repoints it to A (the entry before B).
      const next = dropJourneyEntry(slice(['A', 'B', 'C'], 1), 'B');
      expect(ids(next)).toEqual(['A', 'C']);
      expect(next.currentIndex).toBe(0);
   });

   it('keeps the marker on its own entry when a later entry is dropped', () => {
      const next = dropJourneyEntry(slice(['A', 'B', 'C'], 0), 'C');
      expect(ids(next)).toEqual(['A', 'B']);
      expect(next.currentIndex).toBe(0);
   });

   it('drops every occurrence of a repeated dead entry', () => {
      const next = dropJourneyEntry(slice(['A', 'B', 'A'], 2), 'A');
      expect(ids(next)).toEqual(['B']);
      expect(next.currentIndex).toBe(0);
   });

   it('empties the trail when the only entries are dead', () => {
      expect(dropJourneyEntry(slice(['A'], 0), 'A')).toBe(EMPTY_JOURNEY);
   });
});

describe('rekeyJourneyEntity (Save-As fork adopts a new id)', () => {
   it('rewrites the crumb for the forked entity so the active tab stays on-trail', () => {
      const next = rekeyJourneyEntity(slice(['A', 'B', 'C'], 2), 'C', 'C2');
      expect(ids(next)).toEqual(['A', 'B', 'C2']);
      expect(next.currentIndex).toBe(2);
   });

   it('rewrites every occurrence and preserves the marker', () => {
      const next = rekeyJourneyEntity(slice(['A', 'B', 'A'], 1), 'A', 'A2');
      expect(ids(next)).toEqual(['A2', 'B', 'A2']);
      expect(next.currentIndex).toBe(1);
   });

   it('returns the same slice reference when the id never appears (no churn)', () => {
      const original = slice(['A', 'B'], 1);
      expect(rekeyJourneyEntity(original, 'Z', 'Z2')).toBe(original);
   });

   it('is a no-op when old and new ids are equal', () => {
      const original = slice(['A', 'B'], 1);
      expect(rekeyJourneyEntity(original, 'A', 'A')).toBe(original);
   });
});

describe('deriveCurrentIndex (intact-but-paused manual switch)', () => {
   it('follows the active tab when it is a trail member', () => {
      expect(deriveCurrentIndex(slice(['A', 'B', 'C'], 2), 'B')).toBe(1);
   });

   it('pauses (null) when the active tab is off-trail', () => {
      expect(deriveCurrentIndex(slice(['A', 'B'], 1), 'Z')).toBeNull();
   });

   it('pauses (null) at the menu (no active tab)', () => {
      expect(deriveCurrentIndex(slice(['A', 'B'], 1), null)).toBeNull();
   });

   it('disambiguates a repeat by choosing the member nearest the marker', () => {
      // Two A's (indices 0 and 2); the marker sits at 2, so the nearer A is index 2.
      expect(deriveCurrentIndex(slice(['A', 'B', 'A'], 2), 'A')).toBe(2);
      expect(deriveCurrentIndex(slice(['A', 'B', 'A'], 0), 'A')).toBe(0);
   });
});
