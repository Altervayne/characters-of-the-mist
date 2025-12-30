import { closestCenter, pointerWithin } from "@dnd-kit/core";
import type { CollisionDetection } from "@dnd-kit/core";
import type { DrawerItem, GameSystem, GeneralItemType } from "../types/drawer";
import type { Card, Tracker } from "../types/character";
import type { SortingStrategy } from "@dnd-kit/sortable";


// --- Utility functions ---

/**
 * Converts a character sheet card or tracker into drawer-compatible storage info.
 * Returns a tuple of [item type, game system] - useful when saving items to the drawer.
 */
export function mapItemToStorableInfo(item: Card | Tracker): [GeneralItemType, GameSystem] | null {
   if ('cardType' in item) {
      const game: GameSystem = item.details.game;
      switch (item.cardType) {
         case 'CHARACTER_CARD': return ['CHARACTER_CARD', game];
         case 'CHARACTER_THEME': return ['CHARACTER_THEME', game];
         case 'GROUP_THEME': return ['GROUP_THEME', game];
         case 'LOADOUT_THEME': return ['LOADOUT_THEME', game];
         default: return null;
      }
   }
   if ('trackerType' in item) {
      const game: GameSystem = item.game;
      switch (item.trackerType) {
         case 'STATUS': return ['STATUS_TRACKER', game];
         case 'STORY_TAG': return ['STORY_TAG_TRACKER', game];
         case 'STORY_THEME': return ['STORY_THEME_TRACKER', game];
         default: return null;
      }
   }
   return null;
};



// --- Custom DndToolkit sorting strategies and collision detection ---

/**
 * Custom collision detection for drag-and-drop operations throughout the app.
 * Handles complex drop logic for character sheets, drawer items, folders, and trackers.
 * Makes sure you can only drop items where it actually makes sense to drop them!
 */
export const customCollisionDetection: CollisionDetection = (args) => {
   const activeData = args.active.data.current;
   const activeDataType = args.active.data.current?.type as string;
   const draggedItemType = (activeData?.item as DrawerItem)?.type;

   // --- If dragging a full character sheet ---
   if (draggedItemType === 'FULL_CHARACTER_SHEET') {
      const filteredDroppables = args.droppableContainers.filter((container) => {
         const containerId = container.id.toString();
         const containerType = container.data.current?.type as string;
         return (
            container.id === 'main-character-drop-zone' ||
            containerType === 'drawer-item' ||
            containerType === 'drawer-folder' ||
            containerId.startsWith('drawer-back-button-')
         );
      });
      return pointerWithin({ ...args, droppableContainers: filteredDroppables });
   };

   // --- If dragging a folder ---
   if (activeDataType === 'drawer-folder') {
      const filteredDroppables = args.droppableContainers.filter((container) => {
         const containerType = container.data.current?.type as string;
         const containerId = container.id.toString();
         return (
            containerType === 'drawer-folder' ||
            containerType === 'drawer-drop-zone' ||
            containerId.startsWith('drawer-back-button-')
         );
      });
      return pointerWithin({ ...args, droppableContainers: filteredDroppables });
   };

   // --- If dragging a drawer item ---
   if (activeDataType === 'drawer-item') {
      const folderDroppables = args.droppableContainers.filter(
         (container) => container.data.current?.type === 'drawer-folder' || container.id.toString().startsWith('drawer-back-button-')
      );
      const folderCollisions = pointerWithin({ ...args, droppableContainers: folderDroppables });
      if (folderCollisions.length > 0) {
         return folderCollisions;
      }

      const sheetZoneDroppables = args.droppableContainers.filter((container) => {
         const id = container.id.toString();
         return id === 'character-sheet-main-drop-zone' || id === 'tracker-drop-zone' || id === 'card-drop-zone';
      });
      const sheetZoneCollisions = pointerWithin({ ...args, droppableContainers: sheetZoneDroppables });
      if (sheetZoneCollisions.length > 0) {
         return sheetZoneCollisions;
      }

      const itemDroppables = args.droppableContainers.filter((container) => {
         const type = container.data.current?.type as string;
         return type === 'drawer-item' || type === 'sheet-card' || type === 'sheet-tracker';
      });
      return closestCenter({ ...args, droppableContainers: itemDroppables });
   }

   // --- If dragging from sheet (card or tracker) ---
   if (activeDataType === 'sheet-card' || activeDataType === 'sheet-tracker') {
      // First priority: drawer drop zones (current folder)
      const drawerZoneDroppables = args.droppableContainers.filter((container) => {
         const id = container.id.toString();
         return id.startsWith('drawer-drop-zone-');
      });
      const drawerZoneCollisions = pointerWithin({ ...args, droppableContainers: drawerZoneDroppables });
      if (drawerZoneCollisions.length > 0) {
         return drawerZoneCollisions;
      }

      // Second priority: folders and back buttons (only if not over a drop zone)
      const folderDroppables = args.droppableContainers.filter(
         (container) => container.data.current?.type === 'drawer-folder' || container.id.toString().startsWith('drawer-back-button-')
      );
      const folderCollisions = pointerWithin({ ...args, droppableContainers: folderDroppables });
      if (folderCollisions.length > 0) {
         return folderCollisions;
      }

      // Third priority: other sheet items for reordering
      const sheetItemDroppables = args.droppableContainers.filter((container) => {
         const type = container.data.current?.type as string;
         return type === 'sheet-card' || type === 'sheet-tracker';
      });
      return closestCenter({ ...args, droppableContainers: sheetItemDroppables });
   }

   return closestCenter(args);
};

/**
 * Sorting strategy that keeps items visually static during drag operations.
 * Prevents the jarring "items jumping around" effect - drag previews move, but the list stays put.
 */
export const staticListSortingStrategy: SortingStrategy = () => {
   return {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
   };
};