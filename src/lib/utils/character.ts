// -- Utility Imports --
import cuid from 'cuid';

// -- Types Imports --
import { Character, CityRiftDetails, LegendsHeroDetails } from '@/lib/types/character';
import { GameSystem } from '../types/drawer';



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
      case 'CITY_OF_MIST':
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

      case 'OTHERSCAPE':
         return {
            ...baseCharacter,
            game: 'OTHERSCAPE',
            cards: [],
         };

      case 'LEGENDS':
      default:
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