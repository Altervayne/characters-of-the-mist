// -- Utility Imports --
import cuid from 'cuid';

// -- Types Imports --
import type { Character, CityRiftDetails, LegendsHeroDetails, OtherscapeCharacterDetails } from '@/lib/types/character';
import type { GameSystem } from '../types/drawer';

/**
 * Converts a card theme type string into a CSS class name.
 * Example: "Mythos" → "card-type-mythos", "Self & Noise" → "card-type-self-&-noise"
 */
export function getCardTypeClass(type: string): string {
   return `card-type-${type.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Creates a fresh character sheet for the specified game system.
 * Initializes with appropriate default cards - Hero Card for Legend, Character Card for City/Otherscape.
 * Empty trackers to start, ready for you to build your character!
 */
export function createNewCharacter(name: string, game: GameSystem): Character {
   const baseCharacter: Omit<Character, 'cards' | 'game'> = {
      id: cuid(),
      name: name,
      trackers: {
         statuses: [],
         storyTags: [],
         storyThemes: [],
      },
   };



   switch (game) {
      case 'CITY_OF_MIST': {
         const riftCardId = cuid();
         return {
            ...baseCharacter,
            game: 'CITY_OF_MIST',
            cards: [
               {
                  id: riftCardId,
                  cardType: 'CHARACTER_CARD',
                  title: 'Character Card',
                  order: 0,
                  isFlipped: false,
                  details: {
                     game: 'CITY_OF_MIST',
                     characterName: name,
                     mythos: '',
                     logos: '',
                     crewMembers: [],
                     buildup: 0,
                     nemeses: [],
                  } as CityRiftDetails,
               },
            ],
         };
      }

      case 'OTHERSCAPE': {
         const characterCardId = cuid();
         return {
            ...baseCharacter,
            game: 'OTHERSCAPE',
            cards: [
               {
                  id: characterCardId,
                  cardType: 'CHARACTER_CARD',
                  title: 'Character Card',
                  order: 0,
                  isFlipped: false,
                  details: {
                     game: 'OTHERSCAPE',
                     characterName: name,
                     essence: {
                        mythos: 0,
                        self: 0,
                        noise: 0,
                     },
                     crewRelationships: [],
                     specials: [],
                  } as OtherscapeCharacterDetails,
               },
            ],
         };
      }

      case 'LEGENDS':
      default: {
         const heroCardId = cuid();
         return {
            ...baseCharacter,
            game: 'LEGENDS',
            cards: [
               {
                  id: heroCardId,
                  cardType: 'CHARACTER_CARD',
                  title: 'Hero Card',
                  order: 0,
                  isFlipped: false,
                  details: {
                     game: 'LEGENDS',
                     characterName: name,
                     fellowshipRelationships: [],
                     promise: 0,
                     quintessences: [],
                     backpack: [],
                  } as LegendsHeroDetails,
               },
            ],
         };
      }
   }
}