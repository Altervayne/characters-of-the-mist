import { describe, it, expect } from 'vitest';

import { createCharacterStore } from '@/lib/stores/characterStore';
import { createEmbedSync, seedCharacter, readEmbedItem, embedGame, getReadonlyEmbedStore } from './useEmbedCharacterStore';

import type { StatusTracker, Card } from '@/lib/types/character';

/*
 * The two-way embed sync: a store edit commits the single item back to the board; an external
 * `content.data` change re-seeds the store; neither direction loops back on the other.
 */

function makeStatus(overrides: Partial<StatusTracker> = {}): StatusTracker {
   return { id: 'st-1', name: 'Wounded', trackerType: 'STATUS', tiers: [false, false, false], ...overrides };
}

function makeHost() {
   const store = createCharacterStore();
   store.temporal.getState().pause();
   return store;
}

describe('embedGame', () => {
   it('reads a card\'s own game and defaults a game-agnostic tracker to NEUTRAL', () => {
      expect(embedGame({ details: { game: 'LEGENDS' } })).toBe('LEGENDS');
      expect(embedGame({ details: { game: 'CITY_OF_MIST' } })).toBe('CITY_OF_MIST');
      expect(embedGame({ trackerType: 'STATUS' })).toBe('NEUTRAL'); // no details -> NEUTRAL
   });
});

describe('getReadonlyEmbedStore', () => {
   it('returns ONE shared read-only store per game (so N unselected embeds create ~games, not N stores)', () => {
      const a = getReadonlyEmbedStore('NEUTRAL');
      const b = getReadonlyEmbedStore('NEUTRAL');
      const legends = getReadonlyEmbedStore('LEGENDS');
      expect(a).toBe(b);              // cached: same game -> same instance
      expect(a).not.toBe(legends);    // distinct per game
      expect(a.getState().character?.game).toBe('NEUTRAL'); // seeded with the game for theming
      expect(legends.getState().character?.game).toBe('LEGENDS');
   });
});

describe('seedCharacter / readEmbedItem', () => {
   it('places a tracker into its matching slot and reads it back', () => {
      const status = makeStatus();
      const character = seedCharacter('statuses', status);
      expect(character.trackers.statuses).toEqual([status]);
      expect(character.trackers.storyTags).toEqual([]);
      expect(readEmbedItem('statuses', character)).toEqual(status);
   });

   it('seeds a tracker host as NEUTRAL (a tracker is game-agnostic)', () => {
      const character = seedCharacter('statuses', makeStatus());
      expect(character.game).toBe('NEUTRAL');
   });
});

describe('createEmbedSync', () => {
   it('commits a store edit back to the board exactly once', () => {
      const store = makeHost();
      const commits: unknown[] = [];
      const sync = createEmbedSync(store, 'statuses', makeStatus(), (next) => commits.push(next));

      store.getState().actions.updateStatus('st-1', { tiers: [true, false, false] });

      expect(commits).toHaveLength(1);
      expect((commits[0] as StatusTracker).tiers).toEqual([true, false, false]);
      sync.dispose();
   });

   it('re-seeds the store from an external content.data change', () => {
      const store = makeHost();
      const sync = createEmbedSync(store, 'statuses', makeStatus(), () => {});

      sync.reseed(makeStatus({ name: 'Burned', tiers: [true, true, false] }));

      const item = readEmbedItem('statuses', store.getState().character) as StatusTracker;
      expect(item.name).toBe('Burned');
      expect(item.tiers).toEqual([true, true, false]);
      sync.dispose();
   });

   it('does not bounce a commit back into a re-seed (loop guard)', () => {
      const store = makeHost();
      const commits: unknown[] = [];
      const sync = createEmbedSync(store, 'statuses', makeStatus(), (next) => commits.push(next));

      // An edit commits once; re-seeding with that committed value (the board echo) is a no-op.
      store.getState().actions.updateStatus('st-1', { name: 'Hurt' });
      const committed = commits[commits.length - 1];
      const characterBefore = store.getState().character;

      sync.reseed(committed);

      expect(commits).toHaveLength(1); // no extra commit
      expect(store.getState().character).toBe(characterBefore); // no re-seed (same reference)
      sync.dispose();
   });

   it('does not commit when re-seeding with new external data', () => {
      const store = makeHost();
      const commits: unknown[] = [];
      const sync = createEmbedSync(store, 'statuses', makeStatus(), (next) => commits.push(next));

      sync.reseed(makeStatus({ name: 'External' }));

      expect(commits).toHaveLength(0); // a re-seed must not read as an edit
      sync.dispose();
   });

   it('hosts a CARD in the cards slot and commits a flip back', () => {
      const card = {
         id: 'card-1',
         cardType: 'CHARACTER_THEME',
         title: 'Theme',
         order: 0,
         isFlipped: false,
         details: { game: 'LEGENDS', themeType: 'Origin', mainTag: { id: 'm', name: 'Tag' }, powerTags: [], weaknessTags: [], improvements: [], quest: '' },
      } as unknown as Card;

      const store = makeHost();
      const commits: unknown[] = [];
      const sync = createEmbedSync(store, 'cards', card, (next) => commits.push(next));

      expect(seedCharacter('cards', card).cards).toEqual([card]);
      store.getState().actions.flipCard('card-1');

      expect(commits).toHaveLength(1);
      expect((commits[0] as Card).isFlipped).toBe(true);
      sync.dispose();
   });

   it('hosts duplicates independently even when seeded from the same data (no cross-talk)', () => {
      // The duplicate's inner card id collides with the original's (re-ID leaves inner ids alone);
      // each embed having its own store is what keeps the edits independent.
      const shared = {
         id: 'dup-card', cardType: 'CHARACTER_THEME', title: 'Theme', order: 0, isFlipped: false,
         details: { game: 'LEGENDS', themeType: 'Origin', mainTag: { id: 'm', name: 'Tag' }, powerTags: [], weaknessTags: [], improvements: [], quest: '' },
      } as unknown as Card;

      const original = makeHost();
      const duplicate = makeHost();
      const originalCommits: Card[] = [];
      const duplicateCommits: Card[] = [];
      const a = createEmbedSync(original, 'cards', shared, (next) => originalCommits.push(next as Card));
      const b = createEmbedSync(duplicate, 'cards', shared, (next) => duplicateCommits.push(next as Card));

      // Edit only the duplicate.
      duplicate.getState().actions.flipCard('dup-card');

      expect(duplicateCommits.at(-1)?.isFlipped).toBe(true);
      expect(originalCommits).toHaveLength(0); // the original never re-emits
      expect(original.getState().character?.cards[0].isFlipped).toBe(false); // and its store is untouched
      expect(shared.isFlipped).toBe(false); // the seed object was never mutated in place
      a.dispose();
      b.dispose();
   });

   it('re-seeds the rendered item when content.data is reverted (undo/redo)', () => {
      const store = makeHost();
      const sync = createEmbedSync(store, 'statuses', makeStatus({ tiers: [false, false, false] }), () => {});

      // A board edit lands as new content.data; reverting it (undo) re-seeds the store.
      sync.reseed(makeStatus({ tiers: [true, true, false] }));
      expect((readEmbedItem('statuses', store.getState().character) as StatusTracker).tiers).toEqual([true, true, false]);

      sync.reseed(makeStatus({ tiers: [false, false, false] }));
      expect((readEmbedItem('statuses', store.getState().character) as StatusTracker).tiers).toEqual([false, false, false]);
      sync.dispose();
   });
});
