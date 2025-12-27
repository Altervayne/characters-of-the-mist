import type {
   Character,
   Card,
   LegendsThemeDetails,
   LegendsHeroDetails,
   CityThemeDetails,
   CityRiftDetails,
   OtherscapeThemeDetails,
   OtherscapeLoadoutDetails,
   OtherscapeCharacterDetails,
   Tag,
   StatusTracker,
   BlandTag,
   LegendsThemeType,
   CityThemeType,
   OtherscapeThemeType,
} from '../types/character';
import cuid from 'cuid';



interface LegacyTag {
   name: string;
   isActive: boolean;
   isBurnt: boolean;
}

interface LegacyLegendsThemeContent {
   themebook: string;
   level: LegendsThemeType;
   mainTag: LegacyTag;
   powerTags: LegacyTag[];
   weaknessTags: string[];
   experience: number;
   decay: number;
   bio: { title: string; body: string };
   improvement: { name: string, isUnlocked: boolean }[] | { name: string, isUnlocked: boolean };
}

interface LegacyCityThemeContent {
   themebook: string;
   level: CityThemeType | 'MythosCoM' | 'LogosCoM'; // Support legacy format
   mainTag: LegacyTag;
   powerTags: LegacyTag[];
   weaknessTags: string[];
   experience: number;
   decay: number;
   bio: { title: string; body: string };
   improvement: { name: string, isUnlocked: boolean }[] | { name: string, isUnlocked: boolean };
}

interface LegacyOtherscapeThemeContent {
   themebook: string;
   level: 'MythosOS' | 'SelfOS' | 'NoiseOS'; // Legacy format
   mainTag: LegacyTag;
   powerTags: LegacyTag[];
   weaknessTags: LegacyTag[];
   experience: number;
   decay: number;
   bio: { title: string; body: string };
   improvement: { name: string, isUnlocked: boolean }[] | { name: string, isUnlocked: boolean };
}

interface LegacyTheme {
   isEmpty: boolean;
   content?: LegacyLegendsThemeContent | LegacyCityThemeContent | LegacyOtherscapeThemeContent;
}

interface LegacyCharacter {
   name: string;
   compatibility: string;
   themeOne: LegacyTheme;
   themeTwo: LegacyTheme;
   themeThree: LegacyTheme;
   themeFour: LegacyTheme;
   backpack: LegacyTag[];
   statuses: { name: string; level: boolean[] }[];
   mythos?: string; // City of Mist specific
   logos?: string;   // City of Mist specific
   buildup?: number; // City of Mist specific
}



export interface MigratedCharacterPayload {
   character: Character;
   deconstructedCards: Card[];
   deconstructedTrackers: StatusTracker[];
}



export function transformLegacyCharacter(legacyData: LegacyCharacter): MigratedCharacterPayload {
   if (legacyData.compatibility === 'litm') {
      return transformLegacyLegendsCharacter(legacyData);
   } else if (legacyData.compatibility === 'com') {
      return transformLegacyCityCharacter(legacyData);
   } else if (legacyData.compatibility === 'os') {
      return transformLegacyOtherscapeCharacter(legacyData);
   } else {
      throw new Error('UNSUPPORTED_GAME_SYSTEM');
   }
}

function transformLegacyLegendsCharacter(legacyData: LegacyCharacter): MigratedCharacterPayload {

   const deconstructedCards: Card[] = [];
   const themes: LegacyTheme[] = [legacyData.themeOne, legacyData.themeTwo, legacyData.themeThree, legacyData.themeFour];

   const mapToTag = (tag: LegacyTag): Tag => ({
      id: cuid(),
      name: tag.name,
      isActive: tag.isActive,
      isScratched: tag.isBurnt,
   });

   const mapWeaknessTag = (tagName: string): Tag => ({
      id: cuid(),
      name: tagName,
      isActive: false,
      isScratched: false,
   });

   const mapToBlandTag = (tag: LegacyTag | string): BlandTag => ({
      id: cuid(),
      name: typeof tag === 'string' ? tag : tag.name,
   });

   const themeCards: Card[] = themes.map((theme, index) => {
      if (!theme.isEmpty && theme.content) {
         const { content } = theme;
         const legendsContent = content as LegacyLegendsThemeContent;

         const themeDetails: LegendsThemeDetails = {
            game: 'LEGENDS',
            themebook: legendsContent.themebook,
            themeType: legendsContent.level,
            mainTag: mapToTag(legendsContent.mainTag),
            powerTags: legendsContent.powerTags.map(mapToTag),
            weaknessTags: legendsContent.weaknessTags.map(mapWeaknessTag),
            improve: legendsContent.experience,
            abandon: legendsContent.decay,
            milestone: 0,
            quest: legendsContent.bio.body,
            improvements: Array.isArray(legendsContent.improvement)
               ? legendsContent.improvement.map(imp => mapToBlandTag(imp.name))
               : [mapToBlandTag(legendsContent.improvement.name)],
         };

         const newCard: Card = {
            id: cuid(),
            title: legendsContent.mainTag.name,
            order: index,
            isFlipped: false,
            cardType: 'CHARACTER_THEME',
            details: themeDetails,
         };
         deconstructedCards.push(newCard);
         return newCard;
      }
      return null;
   }).filter((card): card is Card => card !== null);


   const heroDetails: LegendsHeroDetails = {
      game: 'LEGENDS',
      characterName: legacyData.name,
      fellowshipRelationships: [],
      promise: 0,
      quintessences: [],
      backpack: legacyData.backpack.map(mapToBlandTag),
   };

   const heroCard: Card = {
      id: cuid(),
      title: 'Hero Card',
      order: 0,
      isFlipped: false,
      cardType: 'CHARACTER_CARD',
      details: heroDetails,
   };

   const deconstructedTrackers: StatusTracker[] = legacyData.statuses.map(status => ({
      id: cuid(),
      name: status.name,
      game: 'LEGENDS',
      trackerType: 'STATUS',
      tiers: status.level,
   }));

   const newCharacter: Character = {
      id: cuid(),
      name: legacyData.name,
      game: 'LEGENDS',
      cards: [heroCard, ...themeCards.map((card, index) => ({ ...card, order: index + 1 }))],
      trackers: {
         statuses: deconstructedTrackers,
         storyTags: [],
         storyThemes: []
      },
   };

   return {
      character: newCharacter,
      deconstructedCards,
      deconstructedTrackers,
   };
}

function transformLegacyCityCharacter(legacyData: LegacyCharacter): MigratedCharacterPayload {
   const deconstructedCards: Card[] = [];
   const themes: LegacyTheme[] = [legacyData.themeOne, legacyData.themeTwo, legacyData.themeThree, legacyData.themeFour];

   const mapToTag = (tag: LegacyTag): Tag => ({
      id: cuid(),
      name: tag.name,
      isActive: tag.isActive,
      isScratched: tag.isBurnt,
   });

   const mapWeaknessTag = (tagName: string): Tag => ({
      id: cuid(),
      name: tagName,
      isActive: false,
      isScratched: false,
   });

   const mapToBlandTag = (tag: LegacyTag | string): BlandTag => ({
      id: cuid(),
      name: typeof tag === 'string' ? tag : tag.name,
   });

   const themeCards: Card[] = themes.map((theme, index) => {
      if (!theme.isEmpty && theme.content) {
         const { content } = theme;
         const cityContent = content as LegacyCityThemeContent;

         // Convert legacy theme type values (MythosCoM/LogosCoM) to modern values (Mythos/Logos)
         let themeType: CityThemeType;
         if (cityContent.level === 'MythosCoM' || cityContent.level === 'Mythos') {
            themeType = 'Mythos';
         } else if (cityContent.level === 'LogosCoM' || cityContent.level === 'Logos') {
            themeType = 'Logos';
         } else {
            // Fallback to Mythos if unknown
            themeType = 'Mythos';
         }

         const themeDetails: CityThemeDetails = {
            game: 'CITY_OF_MIST',
            themebook: cityContent.themebook,
            themeType: themeType,
            mainTag: mapToTag(cityContent.mainTag),
            powerTags: cityContent.powerTags.map(mapToTag),
            weaknessTags: cityContent.weaknessTags.map(mapWeaknessTag),
            attention: cityContent.experience,
            fadeOrCrack: cityContent.decay,
            mystery: cityContent.bio.body || null,
            improvements: Array.isArray(cityContent.improvement)
               ? cityContent.improvement.map(imp => mapToBlandTag(imp.name))
               : [mapToBlandTag(cityContent.improvement.name)],
         };

         const newCard: Card = {
            id: cuid(),
            title: cityContent.mainTag.name,
            order: index,
            isFlipped: false,
            cardType: 'CHARACTER_THEME',
            details: themeDetails,
         };
         deconstructedCards.push(newCard);
         return newCard;
      }
      return null;
   }).filter((card): card is Card => card !== null);

   const riftDetails: CityRiftDetails = {
      game: 'CITY_OF_MIST',
      characterName: legacyData.name,
      mythos: legacyData.mythos || '',
      logos: legacyData.logos || '',
      crewMembers: [],
      buildup: legacyData.buildup || 0,
      nemeses: legacyData.backpack?.map(mapToBlandTag) || [],
   };

   const riftCard: Card = {
      id: cuid(),
      title: 'Rift Card',
      order: 0,
      isFlipped: false,
      cardType: 'CHARACTER_CARD',
      details: riftDetails,
   };

   const deconstructedTrackers: StatusTracker[] = legacyData.statuses.map(status => ({
      id: cuid(),
      name: status.name,
      game: 'CITY_OF_MIST',
      trackerType: 'STATUS',
      tiers: status.level,
   }));

   const newCharacter: Character = {
      id: cuid(),
      name: legacyData.name,
      game: 'CITY_OF_MIST',
      cards: [riftCard, ...themeCards.map((card, index) => ({ ...card, order: index + 1 }))],
      trackers: {
         statuses: deconstructedTrackers,
         storyTags: [],
         storyThemes: []
      },
   };

   return {
      character: newCharacter,
      deconstructedCards,
      deconstructedTrackers,
   };
}

function transformLegacyOtherscapeCharacter(legacyData: LegacyCharacter): MigratedCharacterPayload {
   const deconstructedCards: Card[] = [];
   const themes: LegacyTheme[] = [legacyData.themeOne, legacyData.themeTwo, legacyData.themeThree, legacyData.themeFour];

   const mapToTag = (tag: LegacyTag): Tag => ({
      id: cuid(),
      name: tag.name,
      isActive: tag.isActive,
      isScratched: tag.isBurnt,
   });

   const mapToBlandTag = (tag: LegacyTag | string): BlandTag => ({
      id: cuid(),
      name: typeof tag === 'string' ? tag : tag.name,
   });

   const themeCards: Card[] = themes.map((theme, index) => {
      if (!theme.isEmpty && theme.content) {
         const { content } = theme;
         const othContent = content as LegacyOtherscapeThemeContent;

         // Convert legacy theme type values (MythosOS/SelfOS/NoiseOS) to modern values (Mythos/Self/Noise)
         let themeType: OtherscapeThemeType;
         if (othContent.level === 'MythosOS') {
            themeType = 'Mythos';
         } else if (othContent.level === 'SelfOS') {
            themeType = 'Self';
         } else if (othContent.level === 'NoiseOS') {
            themeType = 'Noise';
         } else {
            // Fallback to Mythos if unknown
            themeType = 'Mythos';
         }

         const themeDetails: OtherscapeThemeDetails = {
            game: 'OTHERSCAPE',
            themebook: othContent.themebook,
            themeType: themeType,
            mainTag: mapToTag(othContent.mainTag),
            powerTags: othContent.powerTags.map(mapToTag),
            weaknessTags: othContent.weaknessTags.map(mapToTag),
            attention: othContent.experience,
            fadeOrCrack: othContent.decay,
            mystery: othContent.bio.body || null,
            improvements: Array.isArray(othContent.improvement)
               ? othContent.improvement.map(imp => mapToBlandTag(imp.name))
               : [mapToBlandTag(othContent.improvement.name)],
         };

         const newCard: Card = {
            id: cuid(),
            title: othContent.mainTag.name,
            order: index,
            isFlipped: false,
            cardType: 'CHARACTER_THEME',
            details: themeDetails,
         };
         deconstructedCards.push(newCard);
         return newCard;
      }
      return null;
   }).filter((card): card is Card => card !== null);

   // Create Loadout card from backpack items
   const loadoutDetails: OtherscapeLoadoutDetails = {
      game: 'OTHERSCAPE',
      attention: 0,
      crack: 0,
      mainTag: { id: cuid(), name: '', isActive: false, isScratched: false },
      powerTags: legacyData.backpack.map(tag => ({
         id: cuid(),
         name: tag.name,
         isActive: false,
         isScratched: true, // Gear is burned (unloaded) by default
      })),
      weaknessTags: [],
      description: null,
      improvements: [],
      wildcardSlots: 0,
   };

   const loadoutCard: Card = {
      id: cuid(),
      title: 'Loadout',
      order: themeCards.length,
      isFlipped: false,
      cardType: 'LOADOUT_THEME',
      details: loadoutDetails,
   };

   // Count themes by type for essence
   const essenceCounts = themeCards.reduce((acc, card) => {
      const details = card.details as OtherscapeThemeDetails;
      if (details.themeType === 'Mythos') acc.mythos++;
      else if (details.themeType === 'Self') acc.self++;
      else if (details.themeType === 'Noise') acc.noise++;
      return acc;
   }, { mythos: 0, self: 0, noise: 0 });

   const characterDetails: OtherscapeCharacterDetails = {
      game: 'OTHERSCAPE',
      characterName: legacyData.name,
      essence: essenceCounts,
      crewRelationships: [],
      specials: [],
   };

   const characterCard: Card = {
      id: cuid(),
      title: 'Character Card',
      order: 0,
      isFlipped: false,
      cardType: 'CHARACTER_CARD',
      details: characterDetails,
   };

   const deconstructedTrackers: StatusTracker[] = legacyData.statuses.map(status => ({
      id: cuid(),
      name: status.name,
      game: 'OTHERSCAPE',
      trackerType: 'STATUS',
      tiers: status.level,
   }));

   const newCharacter: Character = {
      id: cuid(),
      name: legacyData.name,
      game: 'OTHERSCAPE',
      cards: [
         characterCard,
         ...themeCards.map((card, index) => ({ ...card, order: index + 1 })),
         { ...loadoutCard, order: themeCards.length + 1 }
      ],
      trackers: {
         statuses: deconstructedTrackers,
         storyTags: [],
         storyThemes: []
      },
   };

   return {
      character: newCharacter,
      deconstructedCards,
      deconstructedTrackers,
   };
}