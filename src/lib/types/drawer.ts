// -- Type Imports --
import { Card, Tracker, Character } from './character';



export type DrawerItemContent = Card | Tracker | Character;

export type GameSystem = 'LEGENDS' | 'CITY_OF_MIST' | 'OTHERSCAPE' | 'NEUTRAL';

export type GeneralItemType = 
   | 'FULL_DRAWER'
   | 'FOLDER'
   | 'CHARACTER_CARD'
   | 'CHARACTER_THEME'
   | 'GROUP_THEME'
   | 'STATUS_TRACKER'
   | 'STORY_TAG_TRACKER'
   | 'STORY_THEME_TRACKER'
   | 'FULL_CHARACTER_SHEET';

export interface DrawerItem {
   id: string;
   game: GameSystem;
   type: GeneralItemType;
   name: string;
   content: DrawerItemContent;
}

export interface Folder {
   id: string;
   name: string;
   items: DrawerItem[];
   folders: Folder[];
}


export interface Drawer {
   version?: string;
   folders: Folder[];
   rootItems: DrawerItem[];
}
