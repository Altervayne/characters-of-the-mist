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
   character.cards[0].details as unknown as { width?: number; height?: number };

describe('harmonization: image-card size backfill', () => {
   it('defaults a sizeless IMAGE_CARD to the legacy 250x600', () => {
      const harmonized = harmonizeData(characterWithImageCard(), 'FULL_CHARACTER_SHEET');

      expect(imageDetails(harmonized)).toMatchObject({
         width: LEGACY_IMAGE_CARD_SIZE.width,
         height: LEGACY_IMAGE_CARD_SIZE.height,
      });
   });

   it('leaves an IMAGE_CARD that already has a size untouched', () => {
      const harmonized = harmonizeData(characterWithImageCard({ width: 320, height: 240 }), 'FULL_CHARACTER_SHEET');

      expect(imageDetails(harmonized)).toMatchObject({ width: 320, height: 240 });
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
