// -- Type Imports --
import type { GameSystem, GeneralItemType } from "./common.ts";



// ######################
// ###   BASE TYPES   ###
// ######################

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

// A tracker carries no `game`: it is theme-agnostic and renders from its context character's game
// (the app theme when that context is NEUTRAL / absent, e.g. on the board). `trackerType` is the kind.
export interface StatusTracker {
   id: string;
   name: string;
   trackerType: 'STATUS';
   tiers: boolean[];
}

export interface StoryTagTracker {
   id: string;
   name: string;
   trackerType: 'STORY_TAG';
   isScratched: boolean;
   isWeakness?: boolean;
}

export interface StoryThemeTracker {
  id: string;
  name: string;
  trackerType: 'STORY_THEME';
  mainTag: Tag;
  powerTags: Tag[];
  weaknessTags: Tag[];
}

export type Tracker = StatusTracker | StoryTagTracker | StoryThemeTracker;



// ###############################
// ###   GAME-SPECIFIC TYPES   ###
// ###############################


// ==================
//  LEGEND IN THE MIST
// ==================

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
   backpack: Tag[];
}

// A challenge's status/limit: the app's real status shape (name + tier), so a clicked mention can mint a
// real StatusTracker. Rendered compactly as a `name-tier` pill on the card.
export interface ChallengeStatus {
   id: string;
   name: string;
   tier: number;
}

// One "Threats & Consequences" entry: a tag/name, its flavor, and a dotted consequence list.
export interface ChallengeAbility {
   id: string;
   tag: string;
   flavor: string;
   consequences: { id: string; text: string }[];
}

// A GM Challenge Card (LitM): a current obstacle/adversary. Front = image / name (Card.title) / italic
// types / star level / flavor; back = Limits / Tags & Statuses / Threats & Consequences.
export interface LegendsChallengeDetails {
   game: 'LEGENDS';
   assetId: string | null;
   types: string[];
   challengeLevel: number;
   flavor: string;
   limits: ChallengeStatus[];
   statuses: ChallengeStatus[];
   tags: BlandTag[];
   abilities: ChallengeAbility[];
}


// ==================
//  METRO: OTHERSCAPE
// ==================

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
   specials: Tag[]; // Special attributes/abilities; activatable and burnable like power tags
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
   mainTag: Tag; // Not displayed, but kept for consistency
   powerTags: Tag[]; // Gear items (!isScratched = loaded, isScratched = unloaded)
   weaknessTags: Tag[]; // Flaws
   description: string | null;
   improvements: BlandTag[];
   wildcardSlots: number; // Number of wildcard slots available
}


// ==================
//  CITY OF MIST
// ==================

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
   nemeses: Tag[]; // Activatable and burnable like power tags
}


/**
 * A character portrait, the first consumer of the assets store. Game-agnostic (the
 * Board will reuse the type); the "one per sheet, not creatable in the normal flow"
 * rule is a sheet policy in the store/UI, never baked into the type.
 */
export interface ImageCardDetails {
   /** Always `'NEUTRAL'`: an image card is game-agnostic, so it records no origin game. */
   game: 'NEUTRAL';
   /** The stored asset hash, or `null` for an empty frame. */
   assetId: string | null;
   /** How the image fills the card footprint. */
   fit: 'cover' | 'contain';
   /** Display width in px (persisted card size, not placement; the Board reuses it). */
   width: number;
   /** Display height in px. */
   height: number;
}

// All possible card structures
export type CardDetails =
   | LegendsThemeDetails
   | LegendsFellowshipDetails
   | LegendsHeroDetails
   | LegendsChallengeDetails
   | OtherscapeThemeDetails
   | OtherscapeCrewDetails
   | OtherscapeLoadoutDetails
   | OtherscapeCharacterDetails
   | CityThemeDetails
   | CityCrewDetails
   | ImageCardDetails
   | CityRiftDetails;

// ##############################
// ###   GENERIC INTERFACES   ###
// ##############################

export type CardViewMode = 'FLIP' | 'SIDE_BY_SIDE';

export interface Card {
   id: string;
   title: string;
   order: number;
   isFlipped: boolean;
   viewMode?: CardViewMode | null;
   /**
    * Board display mode, orthogonal to `viewMode`: when set the board item renders the card's
    * expanded landscape sheet in place of the flip card (challenge card only). Absent reads as
    * the normal card display, so existing boards default correctly.
    */
   expanded?: boolean;
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
