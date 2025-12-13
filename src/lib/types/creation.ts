// -- Type Imports --
import { LegendsThemeType, CityThemeType } from "./character";



export type LegendsThemeTypes = 'Origin' | 'Adventure' | 'Greatness';
export type ThemeTypeUnion = LegendsThemeType | CityThemeType;

export interface CreateCardOptions {
   cardType: 'CHARACTER_THEME' | 'GROUP_THEME';
   themebook?: string;
   themeType?: ThemeTypeUnion;
   mainTagName?: string;
   powerTagsCount: number;
   weaknessTagsCount: number;
}