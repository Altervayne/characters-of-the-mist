import { closestCenter, pointerWithin } from "@dnd-kit/core";
import type { CollisionDetection } from "@dnd-kit/core";
import type { DrawerItem, GameSystem, GeneralItemType } from "../types/drawer";
import type { Card, Tracker } from "../types/character";
import type { SortingStrategy } from "@dnd-kit/sortable";


// ==================
//  Utility functions
// ==================

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
         case 'IMAGE_CARD': return ['IMAGE_CARD', game];
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



/**
 * Which sheet section a drawer item type belongs to, so the play area can highlight
 * only the relevant region while still accepting a drop anywhere (the drop is routed
 * by type regardless). Card/theme types → the cards section; tracker types → the
 * trackers section; anything else (e.g. a full character sheet) → null.
 */
export function sheetSectionForItemType(type: GeneralItemType): 'cards' | 'trackers' | null {
   switch (type) {
      case 'CHARACTER_CARD':
      case 'CHARACTER_THEME':
      case 'GROUP_THEME':
      case 'LOADOUT_THEME':
      case 'IMAGE_CARD':
         return 'cards';
      case 'STATUS_TRACKER':
      case 'STORY_TAG_TRACKER':
      case 'STORY_THEME_TRACKER':
         return 'trackers';
      default:
         return null;
   }
}


// ==================
//  Custom DndToolkit sorting strategies and collision detection
// ==================

/**
 * Custom collision detection for drag-and-drop operations throughout the app.
 * Handles complex drop logic for character sheets, drawer items, folders, and trackers.
 * Makes sure you can only drop items where it actually makes sense to drop them!
 */
export const customCollisionDetection: CollisionDetection = (args) => {
   const activeData = args.active.data.current;
   const activeDataType = args.active.data.current?.type as string;
   const draggedItemType = (activeData?.item as DrawerItem)?.type;

   // ==================
   //  If dragging a tab (the desktop tab strip shares the sheet's DndContext)
   // ==================
   // A tab reorders against other tabs, OR saves into the drawer when dropped on a
   // drawer target. Prioritise drawer drop zones, then folders / back-buttons
   // (pointerWithin), and otherwise resolve the tab sortables for reordering.
   if (activeDataType === 'tab') {
      const drawerZoneDroppables = args.droppableContainers.filter((container) =>
         container.id.toString().startsWith('drawer-drop-zone-'),
      );
      const drawerZoneCollisions = pointerWithin({ ...args, droppableContainers: drawerZoneDroppables });
      if (drawerZoneCollisions.length > 0) return drawerZoneCollisions;

      const folderDroppables = args.droppableContainers.filter(
         (container) => container.data.current?.type === 'drawer-folder' || container.id.toString().startsWith('drawer-back-button-'),
      );
      const folderCollisions = pointerWithin({ ...args, droppableContainers: folderDroppables });
      if (folderCollisions.length > 0) return folderCollisions;

      const tabDroppables = args.droppableContainers.filter((container) => container.data.current?.type === 'tab');
      return closestCenter({ ...args, droppableContainers: tabDroppables });
   }

   // ==================
   //  If dragging a full character sheet or a full board
   // ==================
   // A saved board joins this branch: like a character it opens onto the tab strip (its
   // `main-character-drop-zone` collision is a harmless no-op at drop), and it never drops
   // as a component, so it reuses the same tab-strip-priority + sibling-reorder routing.
   // A saved character is a `drawer-item` whose `item.type` is FULL_CHARACTER_SHEET, so
   // it needs BOTH its own high-priority targets AND the ordinary sibling reorder.
   // Priority 1 (pointerWithin): load onto the sheet / open as a tab. In-drawer MOVES
   // (into a folder / the current folder) are resolved by the live-geometry resolver at
   // drop, not this `over`, so no folder/back collision is needed.
   // Priority 2: same-folder REORDER. Strict pointerWithin rarely lands on a
   // sibling row, which is exactly why a saved character never reordered; fall back to the
   // nearest sibling `drawer-item` via closestCenter, EXCLUDING the active item so `over`
   // is always a different row (handleDragEnd's reorder no-ops on a self drop). This
   // mirrors the regular `drawer-item` branch's reorder, kept LAST so the sheet/tab
   // targets still win.
   if (draggedItemType === 'FULL_CHARACTER_SHEET' || draggedItemType === 'FULL_BOARD') {
      const primaryDroppables = args.droppableContainers.filter((container) => (
         container.id === 'main-character-drop-zone' ||
         container.id === 'tab-strip-drop-zone'
      ));
      const primaryCollisions = pointerWithin({ ...args, droppableContainers: primaryDroppables });
      if (primaryCollisions.length > 0) {
         return primaryCollisions;
      }

      const siblingDroppables = args.droppableContainers.filter(
         (container) => container.data.current?.type === 'drawer-item' && container.id !== args.active.id,
      );
      return closestCenter({ ...args, droppableContainers: siblingDroppables });
   };

   // ==================
   //  If dragging a folder
   // ==================
   // Folder reorder uses the expanding-dropzone SLOTS (`drawer-drop-zone`, the
   // FolderDropZone targets): `handleDragEnd`'s slot-placement reads this `over` to land a
   // folder at an exact position. The slots sit BETWEEN folders so they never compete with
   // the folder rows themselves, which stay free for spring-nav (dwell) and nest.
   if (activeDataType === 'drawer-folder') {
      const filteredDroppables = args.droppableContainers.filter(
         (container) => container.data.current?.type === 'drawer-drop-zone',
      );
      return pointerWithin({ ...args, droppableContainers: filteredDroppables });
   };

   // ==================
   //  If dragging a drawer item
   // ==================
   // In-drawer moves (into a folder / Back / the current folder's items body) are now
   // resolved by the live-geometry resolver at drop, which returns
   // before this `over` is read, so the former folder / back-button / items-area-zone
   // collision was dead and is removed. What remains is still live: the sheet drop zones
   // (dropping the item onto the sheet), then same-folder item REORDER over the nearest
   // sibling row (`closestCenter`, resolved by `handleDragEnd`'s reorder path).
   if (activeDataType === 'drawer-item') {
      // Sheet drop zones (character tab) plus the board drop zone (board tab). The board
      // zone exists only when a board is active, so it never competes with the sheet
      // zones, and vice versa - exactly one of them is mounted at a time.
      const surfaceZoneDroppables = args.droppableContainers.filter((container) => {
         const id = container.id.toString();
         return id === 'character-sheet-main-drop-zone' || id === 'tracker-drop-zone' || id === 'card-drop-zone' || id === 'board-drop-zone';
      });
      const surfaceZoneCollisions = pointerWithin({ ...args, droppableContainers: surfaceZoneDroppables });
      if (surfaceZoneCollisions.length > 0) {
         return surfaceZoneCollisions;
      }

      const itemDroppables = args.droppableContainers.filter((container) => {
         const type = container.data.current?.type as string;
         return type === 'drawer-item' || type === 'sheet-card' || type === 'sheet-tracker';
      });
      return closestCenter({ ...args, droppableContainers: itemDroppables });
   }

   // ==================
   //  If dragging from sheet (card or tracker)
   // ==================
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