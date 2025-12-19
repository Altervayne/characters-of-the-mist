// -- Type Imports --
import { LegendsThemeType, CityThemeType, OtherscapeThemeType } from "./character";



export type LegendsThemeTypes = 'Origin' | 'Adventure' | 'Greatness';
export type ThemeTypeUnion = LegendsThemeType | CityThemeType | OtherscapeThemeType;

export interface CreateCardOptions {
   cardType: 'CHARACTER_THEME' | 'GROUP_THEME' | 'LOADOUT_THEME';
   themebook?: string;
   themeType?: ThemeTypeUnion;
   mainTagName?: string;
   powerTagsCount: number;
   weaknessTagsCount: number;
   wildcardSlots?: number;
}