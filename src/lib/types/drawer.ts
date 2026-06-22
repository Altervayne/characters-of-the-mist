// -- Type Imports --
import type { Card, Tracker, Character } from './character.ts';
import type { Board } from './board.ts';
import type { GameSystem, GeneralItemType } from './common.ts';

// Re-export common types for backward compatibility
export type { GameSystem, GeneralItemType };

// A drawer item wraps one saved aggregate: a card, a tracker, a whole character
// (`FULL_CHARACTER_SHEET`), or a whole board (`FULL_BOARD`).
export type DrawerItemContent = Card | Tracker | Character | Board;

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
