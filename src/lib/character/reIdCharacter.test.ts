// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { reIdCharacter } from './reIdCharacter';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Tests for the Save-As character fork's pure re-id: a fresh top-level id AND fresh nested ids (a fully
 * independent copy), `drawerItemId` untouched (a differently-named field the caller overwrites), source
 * untouched. Backs the conflation invariant - the fork can never share the source's character id.
 */

function makeCharacter(): Character {
   return {
      id: 'char-source',
      name: 'Hero',
      game: 'LEGENDS',
      drawerItemId: 'drawer-source',
      cards: [
         { id: 'card-1', cardType: 'THEME_CARD' },
         { id: 'card-2', cardType: 'THEME_CARD' },
      ],
      trackers: { statuses: [{ id: 'status-1', name: 'Hurt', tiers: [] }], storyTags: [], storyThemes: [] },
   } as unknown as Character;
}

describe('reIdCharacter', () => {
   it('mints a fresh top-level id', () => {
      const character = makeCharacter();
      const result = reIdCharacter(character);
      expect(result.id).not.toBe('char-source');
   });

   it('mints fresh nested ids (a fully independent copy)', () => {
      const character = makeCharacter();
      const result = reIdCharacter(character);
      const cardIds = result.cards.map((card) => card.id);
      expect(cardIds).not.toContain('card-1');
      expect(cardIds).not.toContain('card-2');
      expect(new Set(cardIds).size).toBe(cardIds.length);
      expect(result.trackers.statuses[0].id).not.toBe('status-1');
   });

   it('leaves drawerItemId untouched (a differently-named field; the caller overwrites it)', () => {
      const character = makeCharacter();
      const result = reIdCharacter(character);
      expect(result.drawerItemId).toBe('drawer-source');
   });

   it('does not mutate the input', () => {
      const character = makeCharacter();
      reIdCharacter(character);
      expect(character.id).toBe('char-source');
      expect(character.cards[0].id).toBe('card-1');
   });

   it('yields three distinct identities across a Save-As twice, and never conflates with the source', () => {
      const source = makeCharacter();
      const first = reIdCharacter(source);
      const second = reIdCharacter(first);
      expect(new Set([source.id, first.id, second.id]).size).toBe(3);
      expect(first.id).not.toBe(source.id);
   });
});
