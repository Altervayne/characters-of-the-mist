// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { harmonizeData } from './harmonization';
import { LEGACY_IMAGE_CARD_SIZE } from './constants/imageCard';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Tests for the harmonization backfill of image-card sizes: cards created before the
 * resizable IMAGE_CARD gain the legacy 250x600 footprint so they keep their look,
 * while cards that already carry a size pass through untouched.
 */

/** A character holding one image card, with optional size fields on its details. */
function characterWithImageCard(size?: { width: number; height: number }): Character {
   return {
      id: 'char-1',
      name: 'Hero',
      game: 'LEGENDS',
      version: '2.0.0',
      cards: [
         {
            id: 'img-1',
            title: 'Portrait',
            order: 0,
            isFlipped: false,
            cardType: 'IMAGE_CARD',
            details: { game: 'LEGENDS', assetId: 'hash-a', fit: 'cover', ...size },
         },
      ],
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
   } as unknown as Character;
}

const imageDetails = (character: Character) =>
   character.cards[0].details as unknown as { width?: number; height?: number; game?: string };

describe('harmonization: image-card normalization', () => {
   it('defaults a sizeless IMAGE_CARD to the legacy 250x600', () => {
      const harmonized = harmonizeData(characterWithImageCard(), 'FULL_CHARACTER_SHEET');

      expect(imageDetails(harmonized)).toMatchObject({
         width: LEGACY_IMAGE_CARD_SIZE.width,
         height: LEGACY_IMAGE_CARD_SIZE.height,
      });
   });

   it('normalizes a legacy image card\'s game to NEUTRAL', () => {
      // Carries a size already, so only the game needs normalizing (proves the
      // game fix is not gated behind the size backfill).
      const harmonized = harmonizeData(characterWithImageCard({ width: 320, height: 240 }), 'FULL_CHARACTER_SHEET');

      expect(imageDetails(harmonized)).toMatchObject({ game: 'NEUTRAL', width: 320, height: 240 });
   });

   it('backfills a standalone IMAGE_CARD drawer card', () => {
      const card = {
         id: 'img-1',
         title: 'Portrait',
         order: 0,
         isFlipped: false,
         cardType: 'IMAGE_CARD',
         details: { game: 'LEGENDS', assetId: 'hash-a', fit: 'cover' },
      };

      const harmonized = harmonizeData(card, 'IMAGE_CARD') as typeof card;

      expect(harmonized.details).toMatchObject({
         width: LEGACY_IMAGE_CARD_SIZE.width,
         height: LEGACY_IMAGE_CARD_SIZE.height,
      });
   });
});

describe('harmonization: tracker game strip', () => {
   it('drops the defunct game from every tracker on a character', () => {
      const character = {
         id: 'char-1', name: 'Hero', game: 'CITY_OF_MIST', version: '2.0.0', cards: [],
         trackers: {
            statuses: [{ id: 's1', name: 'Hurt', game: 'CITY_OF_MIST', trackerType: 'STATUS', tiers: [false] }],
            storyTags: [{ id: 't1', name: 'Tag', game: 'CITY_OF_MIST', trackerType: 'STORY_TAG', isScratched: false }],
            storyThemes: [{ id: 'h1', name: 'Theme', game: 'CITY_OF_MIST', trackerType: 'STORY_THEME', mainTag: { id: 'm', name: '', isActive: false, isScratched: false }, powerTags: [], weaknessTags: [] }],
         },
      } as unknown as Character;

      const harmonized = harmonizeData(character, 'FULL_CHARACTER_SHEET');

      expect(harmonized.trackers.statuses[0]).not.toHaveProperty('game');
      expect(harmonized.trackers.storyTags[0]).not.toHaveProperty('game');
      expect(harmonized.trackers.storyThemes[0]).not.toHaveProperty('game');
      // The character's own game is untouched.
      expect(harmonized.game).toBe('CITY_OF_MIST');
   });

   it('drops game from a standalone tracker drawer item', () => {
      const tracker = { id: 's1', name: 'Hurt', game: 'LEGENDS', trackerType: 'STATUS', tiers: [false] };
      const harmonized = harmonizeData(tracker, 'STATUS_TRACKER') as typeof tracker;
      expect(harmonized).not.toHaveProperty('game');
      expect(harmonized).toMatchObject({ trackerType: 'STATUS', name: 'Hurt' });
   });
});
