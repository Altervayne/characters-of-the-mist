import {
   Character,
   Card,
   LegendsThemeDetails,
   LegendsHeroDetails,
   CityThemeDetails,
   CityRiftDetails,
   Tag,
   StatusTracker,
   BlandTag,
   LegendsThemeType,
   CityThemeType,
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

interface LegacyTheme {
   isEmpty: boolean;
   content?: LegacyLegendsThemeContent | LegacyCityThemeContent;
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

         const themeDetails: LegendsThemeDetails = {
            game: 'LEGENDS',
            themebook: content.themebook,
            themeType: content.level,
            mainTag: mapToTag(content.mainTag),
            powerTags: content.powerTags.map(mapToTag),
            weaknessTags: content.weaknessTags.map(mapWeaknessTag),
            improve: content.experience,
            abandon: content.decay,
            milestone: 0,
            quest: content.bio.body,
            improvements: Array.isArray(content.improvement)
               ? content.improvement.map(imp => mapToBlandTag(imp.name))
               : [mapToBlandTag(content.improvement.name)],
         };

         const newCard: Card = {
            id: cuid(),
            title: content.mainTag.name,
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