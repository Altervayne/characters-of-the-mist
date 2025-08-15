import { closestCenter, CollisionDetection, pointerWithin } from "@dnd-kit/core";
import { DrawerItem, GameSystem, GeneralItemType } from "../types/drawer";
import { Card, Tracker } from "../types/character";
import { SortingStrategy } from "@dnd-kit/sortable";


// --- Utility functions ---

export function mapItemToStorableInfo(item: Card | Tracker): [GeneralItemType, GameSystem] | null {
   const game: GameSystem = 'LEGENDS';

   if ('cardType' in item) {
      switch (item.cardType) {
         case 'CHARACTER_CARD': return ['CHARACTER_CARD', game];
         case 'CHARACTER_THEME': return ['CHARACTER_THEME', game];
         case 'GROUP_THEME': return ['GROUP_THEME', game];
         default: return null;
      }
   }
   if ('trackerType' in item) {
      switch (item.trackerType) {
         case 'STATUS': return ['STATUS_TRACKER', game];
         case 'STORY_TAG': return ['STORY_TAG_TRACKER', game];
         case 'STORY_THEME': return ['STORY_THEME_TRACKER', game];
         default: return null;
      }
   }
   return null;
};



// --- Custom DndToolkit sorting trategies and collision detection ---

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

   return closestCenter(args);
};

export const staticListSortingStrategy: SortingStrategy = () => {
   return {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
   };
};