// -- Type Imports --
import type { Card, Tracker, Character } from './character.ts';
import type { GameSystem, GeneralItemType } from './common.ts';

// Re-export common types for backward compatibility
export type { GameSystem, GeneralItemType };

export type DrawerItemContent = Card | Tracker | Character;

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
