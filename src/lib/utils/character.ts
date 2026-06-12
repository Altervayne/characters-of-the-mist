// -- Utility Imports --
import cuid from 'cuid';

// -- Types Imports --
import type { TFunction } from 'i18next';
import type { Card, CardDetails, Character, CityRiftDetails, LegendsHeroDetails, OtherscapeCharacterDetails } from '@/lib/types/character';
import type { GameSystem } from '../types/drawer';

/**
 * Converts a card theme type string into a CSS class name.
 * Example: "Mythos" → "card-type-mythos", "Self & Noise" → "card-type-self-&-noise"
 */
export function getCardTypeClass(type: string): string {
   return `card-type-${type.toLowerCase().replace(/\s+/g, '-')}`;
}

// Type guards for card details
function hasCharacterName(details: CardDetails): details is { characterName: string } & CardDetails {
   return 'characterName' in details;
}

function hasThemebook(details: CardDetails): details is { themebook: string } & CardDetails {
   return 'themebook' in details;
}

function hasMainTag(details: CardDetails): details is { mainTag: { name: string } } & CardDetails {
   return 'mainTag' in details && details.mainTag !== null;
}

/**
 * Derives a card's human-readable display title.
 *
 * Character cards resolve to a game-specific name (Hero/Rift/Merc card); loadout
 * and group/fellowship cards prefer their main tag's name (falling back to a
 * game-specific label); character theme cards show "Themebook - Main Tag" (or
 * whichever of the two is present). The translator is passed in so this stays a
 * pure helper usable from any component. Mirrors the (now-removed) inline mobile
 * `getCardTitle`.
 *
 * @param card - The card whose title to derive.
 * @param t - The i18next translator (from `useTranslation`).
 * @returns The localized display title.
 */
export function deriveCardTitle(card: Card, t: TFunction): string {
   // Character cards: show character name
   if (card.cardType === 'CHARACTER_CARD' && hasCharacterName(card.details)) {
      switch (card.details.game) {
         case 'LEGENDS':
            return t('Cards.heroCard');
         case 'CITY_OF_MIST':
            return t('Cards.riftCard');
         case 'OTHERSCAPE':
            return t('Cards.mercCard');
         default:
            return t('Cards.characterCard');
      }
   }

   // Loadout cards: show main tag name
   if (card.cardType === 'LOADOUT_THEME') {
      const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;
      return mainTag || t('Cards.otherscapeLoadoutCard');
   }

   if (card.cardType === 'GROUP_THEME') {
      const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;

      if (mainTag) {
         switch (card.details.game) {
            case 'LEGENDS':
               return `${t('Cards.fellowshipCard')} - ${mainTag}`;
            case 'CITY_OF_MIST':
               return `${t('Cards.crewCard')} - ${mainTag}`;
            case 'OTHERSCAPE':
               return `${t('Cards.otherscapeCrewCard')} - ${mainTag}`;
            default:
               return mainTag;
         }
      }
      return t('Cards.fellowshipCard');
   }

   // Theme cards: show "Themebook - Main Tag" or just themebook
   if (card.cardType === 'CHARACTER_THEME') {
      const themebook = hasThemebook(card.details) ? card.details.themebook : null;
      const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;

      if (themebook && mainTag) {
         return `${themebook} - ${mainTag}`;
      }
      if (themebook) {
         return themebook;
      }
      if (mainTag) {
         return mainTag;
      }
   }

   // Fallback to card type
   return t('Cards.themeCard');
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