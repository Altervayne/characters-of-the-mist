// -- Other Library Imports --
import cuid from 'cuid';

// -- Utils Imports --
import { emptyCharacterCardDetails } from '@/lib/utils/character';

// -- Type Imports --
import type {
   Card,
   Tag,
   LegendsThemeDetails,
   LegendsFellowshipDetails,
   CityThemeDetails,
   CityCrewDetails,
   OtherscapeThemeDetails,
   OtherscapeCrewDetails,
   OtherscapeLoadoutDetails,
} from '@/lib/types/character';
import type { CreateCardOptions } from '@/lib/types/creation';
import type { GameSystem } from '@/lib/types/drawer';

/*
 * The single source for a fresh card from a creation dialog's options. Parameterized by an EXPLICIT
 * game (never the active character) so the board can build a card of any game; the character store's
 * `addCard` reuses it for the active game. A character name produces the sheet's familiar titles;
 * without one (a board-native card) the title is a plain type label.
 */

const createTags = (count: number): Tag[] => Array.from({ length: count }, () => ({ id: cuid(), name: '', isActive: false, isScratched: false }));

/** The theme card's title: the sheet's "<name>'s Theme Card - ..." with a character, else a plain label. */
function themeCardTitle(characterName: string | undefined, themebook: string | undefined, themeType: string | undefined): string {
   if (characterName) return `${characterName}'s Theme Card - ${themebook ? themebook + '/' : ''}${themeType ?? ''}`;
   return themebook || themeType || 'Theme Card';
}

/** The board-native character card's title, by game. */
function characterCardTitle(game: GameSystem): string {
   return game === 'OTHERSCAPE' ? 'Merc Card' : game === 'CITY_OF_MIST' ? 'Rift Card' : 'Hero Card';
}

/**
 * Builds a fresh card for `game` from the dialog `options`, or `null` for a game/type combination
 * with no card (the dialog never offers one). `characterName` is optional - the board omits it.
 */
export function buildCard(game: GameSystem, options: CreateCardOptions, characterName?: string): Card | null {
   const base = { id: cuid(), order: 0, isFlipped: false };

   if (options.cardType === 'CHARACTER_CARD') {
      return { ...base, cardType: 'CHARACTER_CARD', title: characterCardTitle(game), details: emptyCharacterCardDetails(game, characterName ?? '') };
   }

   if (game === 'LEGENDS') {
      if (options.cardType === 'GROUP_THEME') {
         return {
            ...base,
            cardType: 'GROUP_THEME',
            title: characterName ? `${characterName}'s Fellowship Theme Card` : 'Fellowship Theme',
            details: {
               game: 'LEGENDS', milestone: 0, abandon: 0, improve: 0,
               mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               quest: '', improvements: [],
            } as LegendsFellowshipDetails,
         };
      }
      if (options.cardType === 'CHARACTER_THEME') {
         return {
            ...base,
            cardType: 'CHARACTER_THEME',
            title: themeCardTitle(characterName, options.themebook, options.themeType),
            details: {
               game: 'LEGENDS', themebook: options.themebook || '', themeType: options.themeType || 'Origin',
               milestone: 0, abandon: 0, improve: 0,
               mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               quest: '', improvements: [],
            } as LegendsThemeDetails,
         };
      }
   } else if (game === 'CITY_OF_MIST') {
      if (options.cardType === 'CHARACTER_THEME') {
         return {
            ...base,
            cardType: 'CHARACTER_THEME',
            title: themeCardTitle(characterName, options.themebook, options.themeType),
            details: {
               game: 'CITY_OF_MIST', themebook: options.themebook || '', themeType: options.themeType || 'Mythos',
               attention: 0, fadeOrCrack: 0,
               mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               mystery: null, improvements: [],
            } as CityThemeDetails,
         };
      }
      if (options.cardType === 'GROUP_THEME') {
         return {
            ...base,
            cardType: 'GROUP_THEME',
            title: 'Crew Theme',
            details: {
               game: 'CITY_OF_MIST', attention: 0, crack: 0,
               mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               identity: null, improvements: [],
            } as CityCrewDetails,
         };
      }
   } else if (game === 'OTHERSCAPE') {
      if (options.cardType === 'CHARACTER_THEME') {
         return {
            ...base,
            cardType: 'CHARACTER_THEME',
            title: themeCardTitle(characterName, options.themebook, options.themeType),
            details: {
               game: 'OTHERSCAPE', themebook: options.themebook || '', themeType: options.themeType || 'Mythos',
               attention: 0, fadeOrCrack: 0,
               mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               mystery: null, improvements: [],
            } as OtherscapeThemeDetails,
         };
      }
      if (options.cardType === 'GROUP_THEME') {
         return {
            ...base,
            cardType: 'GROUP_THEME',
            title: 'Crew Theme',
            details: {
               game: 'OTHERSCAPE', attention: 0, crack: 0,
               mainTag: { id: cuid(), name: options.mainTagName || '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               identity: null, improvements: [],
            } as OtherscapeCrewDetails,
         };
      }
      if (options.cardType === 'LOADOUT_THEME') {
         return {
            ...base,
            cardType: 'LOADOUT_THEME',
            title: 'Loadout',
            details: {
               game: 'OTHERSCAPE', attention: 0, crack: 0,
               mainTag: { id: cuid(), name: '', isActive: false, isScratched: false },
               powerTags: createTags(options.powerTagsCount), weaknessTags: createTags(options.weaknessTagsCount),
               description: null, improvements: [], wildcardSlots: options.wildcardSlots || 0,
            } as OtherscapeLoadoutDetails,
         };
      }
   }

   return null;
}
