// -- Type Imports --
import type { GameSystem, GeneralItemType } from "./common.ts";



// *######################*
// |###   BASE TYPES   ###|
// *######################*

export interface Tag {
   id: string;
   name: string;
   isActive: boolean;
   isScratched: boolean;
}

export interface BlandTag {
   id: string;
   name: string;
}

export interface StatusTracker {
   id: string;
   name: string;
   game: GameSystem;
   trackerType: 'STATUS';
   tiers: boolean[];
}

export interface StoryTagTracker {
   id: string;
   name: string;
   game: GameSystem;
   trackerType: 'STORY_TAG';
   isScratched: boolean;
   isWeakness?: boolean;
}

export interface StoryThemeTracker {
  id: string;
  name: string;
  game: GameSystem;
  trackerType: 'STORY_THEME';
  mainTag: Tag;
  powerTags: Tag[];
  weaknessTags: Tag[];
}

export type Tracker = StatusTracker | StoryTagTracker | StoryThemeTracker;



// *###############################*
// |###   GAME-SPECIFIC TYPES   ###|
// *###############################*


// --- LEGENDS IN THE MIST ---

export type LegendsThemeType = 'Origin' | 'Adventure' | 'Greatness';

export interface LegendsThemeDetails {
   game: 'LEGENDS';
   themebook: string;
   themeType: LegendsThemeType;
   abandon: number;
   improve: number;
   milestone: number;
   mainTag: Tag;
   powerTags: Tag[];
   weaknessTags: Tag[];
   quest: string | null;
   improvements: BlandTag[];
}

export interface LegendsFellowshipDetails {
   game: 'LEGENDS';
   abandon: number;
   improve: number;
   milestone: number;
   mainTag: Tag;
   powerTags: Tag[];
   weaknessTags: Tag[];
   quest: string | null;
   improvements: BlandTag[];
}

export interface FellowshipRelationship {
   id: string;
   companionName: string;
   relationshipTag: string;
}

export interface LegendsHeroDetails {
   game: 'LEGENDS';
   characterName: string;
   fellowshipRelationships: FellowshipRelationship[];
   promise: number;
   quintessences: BlandTag[];
   backpack: BlandTag[];
}


// --- METRO: OTHERSCAPE ---

export type OtherscapeThemeType = 'Mythos' | 'Self' | 'Noise';

export interface OtherscapeCharacterDetails {
   game: 'OTHERSCAPE';
   characterName: string;
   essence: {
      mythos: number; // Count of Mythos themes
      self: number;   // Count of Self themes
      noise: number;  // Count of Noise themes
   };
   crewRelationships: FellowshipRelationship[]; // Same structure as Fellowship relationships: Name + Tag
   specials: BlandTag[]; // Special attributes/abilities
}

export interface OtherscapeThemeDetails {
   game: 'OTHERSCAPE';
   themebook: string;
   themeType: OtherscapeThemeType;
   attention: number;
   fadeOrCrack: number; // Fade for Mythos/Self, Crack for Noise
   mainTag: Tag;
   powerTags: Tag[];
   weaknessTags: Tag[];
   mystery: string | null;
   improvements: BlandTag[];
}

export interface OtherscapeCrewDetails {
   game: 'OTHERSCAPE';
   attention: number;
   crack: number; // Crew uses crack
   mainTag: Tag;
   powerTags: Tag[];
   weaknessTags: Tag[];
   identity: string | null;
   improvements: BlandTag[];
}

export interface OtherscapeLoadoutDetails {
   game: 'OTHERSCAPE';
   attention: number;
   crack: number; // Loadout uses crack
   mainTag: Tag; // Not displayed, but kept for structural consistency
   powerTags: Tag[]; // Gear items (isActive = loaded, !isActive = unloaded)
   weaknessTags: Tag[]; // Flaws
   description: string | null;
   improvements: BlandTag[];
   wildcardSlots: number; // Number of wildcard slots available
}


// --- CITY OF MIST ---

export type CityThemeType = 'Mythos' | 'Logos';

export interface CityThemeDetails {
   game: 'CITY_OF_MIST';
   themebook: string;
   themeType: CityThemeType;
   attention: number;
   fadeOrCrack: number; // Fade for Mythos, Crack for Logos
   mainTag: Tag;
   powerTags: Tag[];
   weaknessTags: Tag[];
   mystery: string | null;
   improvements: BlandTag[];
}

export interface CrewMember {
   id: string;
   name: string;
   help: string;
   hurt: string;
}

export interface CityCrewDetails {
   game: 'CITY_OF_MIST';
   attention: number;
   crack: number; // Crew uses crack like Logos
   mainTag: Tag;
   powerTags: Tag[];
   weaknessTags: Tag[];
   identity: string | null; // Crew has identity like Logos
   improvements: BlandTag[];
}

export interface CityRiftDetails {
   game: 'CITY_OF_MIST';
   characterName: string;
   mythos: string;
   logos: string;
   crewMembers: CrewMember[];
   buildup: number;
   nemeses: BlandTag[];
}


// All possible card structures
export type CardDetails =
   | LegendsThemeDetails
   | LegendsFellowshipDetails
   | LegendsHeroDetails
   | OtherscapeThemeDetails
   | OtherscapeCrewDetails
   | OtherscapeLoadoutDetails
   | OtherscapeCharacterDetails
   | CityThemeDetails
   | CityCrewDetails
   | CityRiftDetails;

// *##############################*
// |###   GENERIC INTERFACES   ###|
// *##############################*

export type CardViewMode = 'FLIP' | 'SIDE_BY_SIDE';

export interface Card {
   id: string;
   title: string;
   order: number;
   isFlipped: boolean;
   viewMode?: CardViewMode | null;
   cardType: GeneralItemType; 
   details: CardDetails;
}

export interface Character {
   id: string;
   name: string;
   game: GameSystem;
   version?: string;
   drawerItemId?: string;
   cards: Card[];
   trackers: {
      statuses: StatusTracker[];
      storyTags: StoryTagTracker[];
      storyThemes: StoryThemeTracker[];
   };
}
