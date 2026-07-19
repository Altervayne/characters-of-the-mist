// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { reIdCharacterAggregate } from './reIdCharacterAggregate';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Tests for the cross-reference-safe character re-id used on import and Save-As. The crucial properties:
 * the character/card/journal ids change AND the sheet-layout manifest still resolves to the new card/journal
 * ids (order preserved), each journal's bookmarks still land on its own pages, and asset hashes survive -
 * all of which a generic `deepReId` would break.
 */

function makeCharacter(): Character {
   return {
      id: 'char-source',
      name: 'Hero',
      game: 'LEGENDS',
      drawerItemId: 'drawer-source',
      cards: [
         { id: 'card-1', title: 'Theme', isFlipped: false, cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS', mainTag: { id: 'tag-1', name: 'Brave', isActive: true, isScratched: false } } },
         { id: 'card-portrait', title: 'Portrait', isFlipped: false, cardType: 'IMAGE_CARD', details: { game: 'NEUTRAL', assetId: 'sha-abc123', fit: 'cover', width: 250, height: 600 } },
      ],
      journals: [
         {
            id: 'journal-1',
            title: 'Log',
            pages: [
               { id: 'page-a', text: 'first' },
               { id: 'page-b', text: 'second' },
            ],
            bookmarks: [{ id: 'bm-1', pageId: 'page-b', label: 'Chapter 2' }],
         },
      ],
      // Custom interleave: journal sits BETWEEN the two cards, not appended after them.
      sheetLayout: [
         { kind: 'card', id: 'card-1' },
         { kind: 'journal', id: 'journal-1' },
         { kind: 'card', id: 'card-portrait' },
      ],
      trackers: { statuses: [{ id: 'status-1', name: 'Hurt', trackerType: 'STATUS', tiers: [true, false] }], storyTags: [], storyThemes: [] },
   } as unknown as Character;
}

describe('reIdCharacterAggregate', () => {
   it('mints a fresh character id', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      expect(result.id).not.toBe('char-source');
   });

   it('remints the top-level card and journal ids', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      const cardIds = result.cards.map((c) => c.id);
      expect(cardIds).not.toContain('card-1');
      expect(cardIds).not.toContain('card-portrait');
      expect(result.journals[0].id).not.toBe('journal-1');
   });

   it('remaps the sheet layout to the new ids, preserving kind and order', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      const [c1, portrait] = result.cards;
      const journal = result.journals[0];
      expect(result.sheetLayout).toEqual([
         { kind: 'card', id: c1.id },
         { kind: 'journal', id: journal.id },
         { kind: 'card', id: portrait.id },
      ]);
   });

   it('keeps each journal\'s pages and bookmarks verbatim, so bookmark->page still resolves', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      const journal = result.journals[0];
      // Pages keep their ids; the bookmark still names an existing page in the same journal.
      expect(journal.pages.map((p) => p.id)).toEqual(['page-a', 'page-b']);
      expect(journal.bookmarks[0].pageId).toBe('page-b');
      expect(journal.pages.some((p) => p.id === journal.bookmarks[0].pageId)).toBe(true);
   });

   it('preserves asset hashes (content-hash keys, not entity ids)', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      const portrait = result.cards.find((c) => c.cardType === 'IMAGE_CARD')!;
      expect((portrait.details as { assetId: string }).assetId).toBe('sha-abc123');
   });

   it('remints nested value-object ids fresh (a truly independent copy)', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      const theme = result.cards.find((c) => c.cardType === 'CHARACTER_THEME')!;
      expect((theme.details as { mainTag: { id: string } }).mainTag.id).not.toBe('tag-1');
      expect(result.trackers.statuses[0].id).not.toBe('status-1');
   });

   it('clears drawerItemId so an import can\'t stale-link to a drawer item', () => {
      const result = reIdCharacterAggregate(makeCharacter());
      expect(result.drawerItemId).toBeUndefined();
   });

   it('does not mutate the input', () => {
      const character = makeCharacter();
      reIdCharacterAggregate(character);
      expect(character.id).toBe('char-source');
      expect(character.cards[0].id).toBe('card-1');
      expect(character.journals[0].pages[0].id).toBe('page-a');
      expect(character.sheetLayout[1]).toEqual({ kind: 'journal', id: 'journal-1' });
   });
});
