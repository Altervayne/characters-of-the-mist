// -- React Imports --
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';

// -- Utils Imports --
import { findFolder } from '@/lib/utils/drawer';
import { mapItemToStorableInfo } from '@/lib/utils/dnd';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';



/**
 * Owns the entire character-sheet drag-and-drop subsystem.
 *
 * Encapsulates the active drag item and hover state, the three sheet drop zones
 * (trackers, cards, and the main play area), the memoized SortableContext id
 * arrays, and the full set of @dnd-kit event handlers. `handleDragEnd` routes
 * every supported drop - drawer-to-sheet character loads and component imports,
 * sheet-to-drawer saves, in-drawer moves and reorders, and on-sheet reordering -
 * by inspecting the drag source and target and dispatching directly to the
 * character and drawer store actions. The page only forwards `handleDragStart`,
 * `handleDragOver`, and `handleDragEnd` to its `DndContext` and wires the
 * returned refs, id arrays, and drag state into its JSX.
 *
 * @returns The drag state, drop-zone refs and hover flags, memoized id arrays,
 *   and the `DndContext` event handlers.
 */
export function useCharacterSheetDnD() {
   const { t: tNotifications } = useTranslation();

   const character = useCharacterStore((state) => state.character);
   const { loadCharacter, reorderCards, reorderStatuses, reorderStoryTags, reorderStoryThemes,
            addImportedCard, addImportedTracker } = useCharacterActions();
   const drawer = useDrawerStore((state) => state.drawer);
   const { initiateItemDrop, moveFolder, reorderFolders, moveItem, reorderItems } = useDrawerActions();
   const { setContextualGame } = useAppSettingsActions();

   // --- Utility & Library States ---
   const [isOverDrawer, setIsOverDrawer] = useState(false);
   const [activeDragItem, setActiveDragItem] = useState<CardData | Tracker | DrawerItem | FolderType | null>(null);
   const [overDragId, setOverDragId] = useState<string | null>(null);

   const { isOver: isOverTrackers, setNodeRef: setTrackersDropRef } = useDroppable({
      id: 'tracker-drop-zone',
      data: { type: 'tracker-drop-zone' }
   });
   const { isOver: isOverCards, setNodeRef: setCardsDropRef } = useDroppable({
      id: 'card-drop-zone',
      data: { type: 'card-drop-zone' }
   });
   const { isOver: isOverMain, setNodeRef: setMainDropRef } = useDroppable({
      id: 'character-sheet-main-drop-zone',
      data: { type: 'character-sheet-main-drop-zone' }
   });

   // Memoize SortableContext arrays to prevent unnecessary re-renders
   const statusIds = useMemo(
      () => character?.trackers.statuses.map(t => t.id) || [],
      [character?.trackers.statuses]
   );
   const storyTagIds = useMemo(
      () => character?.trackers.storyTags.map(t => t.id) || [],
      [character?.trackers.storyTags]
   );
   const storyThemeIds = useMemo(
      () => character?.trackers.storyThemes.map(t => t.id) || [],
      [character?.trackers.storyThemes]
   );
   const cardIds = useMemo(
      () => character?.cards.map(c => c.id) || [],
      [character?.cards]
   );

   const handleDragStart = useCallback((event: DragStartEvent) => {
      const { active } = event;

      if (active.data.current?.isDrawer) {
         setActiveDragItem(active.data.current.item as DrawerItem | FolderType);
         return;
      }

      const allSheetItems = [...(character?.cards || []), ...(character?.trackers.statuses || []), ...(character?.trackers.storyTags || []), ...(character?.trackers.storyThemes || [])];
      const item = allSheetItems.find(i => i.id === active.id);
      if (item) {
         setActiveDragItem(item);
      }
   }, [character?.cards, character?.trackers]);

   const handleDragOver = useCallback((event: DragOverEvent) => {
      const { active, over } = event;

      setOverDragId(over ? over.id.toString() : null);

      let isHoveringDrawer = false;
      if (over) {
        const activeType = active.data.current?.type as string;
        const overId = over.id.toString();
        const overIsDrawerComponent = over.data.current?.isDrawer || overId.startsWith('drawer-drop-zone-');

         if (activeType?.startsWith('sheet-') && overIsDrawerComponent) {
            isHoveringDrawer = true;
         }
      }

      setIsOverDrawer(isHoveringDrawer);
   }, []);

   /**
    * Handle reordering cards on the character sheet
    */
   const handleSheetCardReorder = useCallback((activeId: string, overId: string) => {
      if (!character) return;
      const oldIndex = character.cards.findIndex(item => item.id === activeId);
      const newIndex = character.cards.findIndex(item => item.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
         reorderCards(oldIndex, newIndex);
      }
   }, [character, reorderCards]);

   /**
    * Handle reordering trackers on the character sheet
    */
   const handleSheetTrackerReorder = useCallback((
      active: DragStartEvent['active'],
      over: NonNullable<DragOverEvent['over']>
   ) => {
      if (!character) return;

      const activeTracker = active.data.current?.item as Tracker;
      const overTracker = over.data.current?.item as Tracker;

      if (!activeTracker?.trackerType || !overTracker?.trackerType) return;
      if (activeTracker.trackerType !== overTracker.trackerType) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      if (activeTracker.trackerType === 'STATUS') {
         const oldIndex = character.trackers.statuses.findIndex(item => item.id === activeId);
         const newIndex = character.trackers.statuses.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && newIndex !== -1) reorderStatuses(oldIndex, newIndex);
      } else if (activeTracker.trackerType === 'STORY_TAG') {
         const oldIndex = character.trackers.storyTags.findIndex(item => item.id === activeId);
         const newIndex = character.trackers.storyTags.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && newIndex !== -1) reorderStoryTags(oldIndex, newIndex);
      } else if (activeTracker.trackerType === 'STORY_THEME') {
         const oldIndex = character.trackers.storyThemes.findIndex(item => item.id === activeId);
         const newIndex = character.trackers.storyThemes.findIndex(item => item.id === overId);
         if (oldIndex !== -1 && newIndex !== -1) reorderStoryThemes(oldIndex, newIndex);
      }
   }, [character, reorderStatuses, reorderStoryTags, reorderStoryThemes]);

   /**
    * Handle dropping sheet items (cards/trackers) back into the drawer
    */
   const handleSheetToDrawerDrop = useCallback((
      overIdStr: string,
      overType: string,
      over: NonNullable<DragOverEvent['over']>
   ) => {
      if (!activeDragItem) return;

      let destinationFolderId: string | undefined = undefined;

      if (overType === 'drawer-folder') {
         destinationFolderId = overIdStr;
      } else if (overIdStr.startsWith('drawer-drop-zone-')) {
         const parsedId = overIdStr.replace('drawer-drop-zone-', '');
         destinationFolderId = parsedId === 'root' ? undefined : parsedId;
      } else if (overType === 'drawer-back-button') {
         destinationFolderId = over.data.current?.destinationId ?? undefined;
      }

      const storableInfo = mapItemToStorableInfo(activeDragItem as CardData | Tracker);
      if (!storableInfo) return;
      const [generalType, gameSystem] = storableInfo;

      const itemContentCopy = JSON.parse(JSON.stringify(activeDragItem));
      if ('isFlipped' in itemContentCopy) itemContentCopy.isFlipped = false;

      const defaultName = 'title' in activeDragItem ? activeDragItem.title :
                     'name' in activeDragItem ? activeDragItem.name : 'New Item';

      initiateItemDrop({
         game: gameSystem,
         type: generalType,
         content: itemContentCopy,
         parentFolderId: destinationFolderId,
         defaultName
      });
   }, [activeDragItem, initiateItemDrop]);

   const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;

      setActiveDragItem(null);
      setIsOverDrawer(false);
      setOverDragId(null);

      if (!over || active.id === over.id) {
         return;
      }

      const activeType = active.data.current?.type as string;
      const overType = over.data.current?.type as string;
      const overIdStr = over.id.toString();

      // ##############################################
      // ###   BRANCH 1: Dragging FROM the Drawer   ###
      // ##############################################
      if (activeType === 'drawer-item' || activeType === 'drawer-folder') {

         // --- SCENARIO 1.1: Dropping a full character onto the play area ---
         if (overIdStr === 'main-character-drop-zone') {
            const draggedItem = active.data.current?.item as DrawerItem;
            if (draggedItem?.type === 'FULL_CHARACTER_SHEET') {
               const characterData = draggedItem.content as Character;
               loadCharacter(characterData, draggedItem.id);
               setContextualGame(characterData.game);
            }
            return;
         }

         // --- SCENARIO 1.2: Dropping INSIDE the drawer ---
         if (overType?.startsWith('drawer-') || overIdStr.startsWith('drawer-')) {
            const activeIsFolder = activeType === 'drawer-folder';
            const activeIsItem = activeType === 'drawer-item';
            const parentFolderId = active.data.current?.parentFolderId ?? null;
            const folderData = parentFolderId ? findFolder(drawer.folders, parentFolderId) : null;
            const itemsInScope = parentFolderId ? folderData?.items : drawer.rootItems;
            const foldersInScope = parentFolderId ? folderData?.folders : drawer.folders;

            if (!itemsInScope || !foldersInScope) return;

            if (overIdStr.startsWith('drawer-back-button-')) {
               const draggedId = active.id.toString();
               const destinationId = over.data.current?.destinationId;
               if (activeIsFolder) moveFolder(draggedId, destinationId);
               if (activeIsItem) moveItem(draggedId, destinationId);
               return;
            }
            if (overType === 'drawer-drop-zone' && activeIsFolder) {
               const oldIndex = foldersInScope.findIndex(folder => folder.id === active.id);
               if (oldIndex === -1) return;
               const { targetId } = over.data.current as { targetId: string; };
               let newIndex = (targetId === 'last')
                  ? foldersInScope.length - 1
                  : foldersInScope.findIndex(folder => folder.id === targetId);
               if (newIndex === -1) return;
               if (oldIndex < newIndex) newIndex--;
               if (oldIndex === newIndex) return;
               reorderFolders(parentFolderId, oldIndex, newIndex);
               return;
            }
            if (overType === 'drawer-folder') {
               if (active.id === over.id) return;
               const draggedId = active.id.toString();
               const destinationFolderId = overIdStr;
               if (activeIsFolder) moveFolder(draggedId, destinationFolderId);
               if (activeIsItem) moveItem(draggedId, destinationFolderId);
               return;
            }
            if (overType === 'drawer-item' && activeIsItem) {
               if (active.data.current?.parentFolderId !== over.data.current?.parentFolderId) return;
               const oldIndex = itemsInScope.findIndex(item => item.id === active.id);
               const newIndex = itemsInScope.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && newIndex !== -1) reorderItems(parentFolderId, oldIndex, newIndex);
               return;
            }
         }

         // --- SCENARIO 1.3: Dropping ONTO the character sheet ---
         // (Requires a character to be loaded)
         if (!character) return;

         const isOverSheet = overIdStr === 'character-sheet-main-drop-zone' ||
                              overIdStr === 'tracker-drop-zone' ||
                              overIdStr === 'card-drop-zone' ||
                              overType === 'sheet-card' ||
                              overType === 'sheet-tracker';

         if (isOverSheet) {
            if (activeType !== 'drawer-item') return;

            const draggedItem = active.data.current?.item as DrawerItem;
            if (!draggedItem || draggedItem.game !== character.game) return;

            const isTrackerType = draggedItem.type === 'STATUS_TRACKER' || draggedItem.type === 'STORY_TAG_TRACKER' || draggedItem.type === 'STORY_THEME_TRACKER';
            const isCardType = draggedItem.type === 'CHARACTER_CARD' || draggedItem.type === 'CHARACTER_THEME' || draggedItem.type === 'GROUP_THEME' || draggedItem.type === 'LOADOUT_THEME';

            if (isTrackerType) {
               addImportedTracker(draggedItem.content as Tracker);
               toast.success(tNotifications('Notifications.character.componentImported'));
            } else if (isCardType) {
               addImportedCard(draggedItem.content as CardData);
               toast.success(tNotifications('Notifications.character.componentImported'));
            }
            return;
         }
      }

      // #############################################
      // ###   BRANCH 2: Dragging FROM the Sheet   ###
      // #############################################
      if (activeType?.startsWith('sheet-')) {

         // --- SCENARIO 2.1: Dropping ONTO the drawer ---
         if (overIdStr.startsWith('drawer-drop-zone-') || overType?.startsWith('drawer-')) {
            handleSheetToDrawerDrop(overIdStr, overType, over);
            return;
         }

         // --- SCENARIO 2.2: Reordering ON the sheet ---
         if (overType?.startsWith('sheet-') && character) {
            if (activeType === DRAG_TYPES.SHEET_CARD && overType === DRAG_TYPES.SHEET_CARD) {
               handleSheetCardReorder(active.id as string, over.id as string);
            } else if (activeType === DRAG_TYPES.SHEET_TRACKER) {
               handleSheetTrackerReorder(active, over);
            }
         }
      }
   }, [
      character,
      drawer,
      moveFolder,
      reorderFolders,
      moveItem,
      reorderItems,
      handleSheetCardReorder,
      handleSheetTrackerReorder,
      handleSheetToDrawerDrop,
      loadCharacter,
      setContextualGame,
      addImportedTracker,
      addImportedCard,
      tNotifications,
   ]);

   return {
      activeDragItem,
      overDragId,
      isOverDrawer,
      setTrackersDropRef,
      isOverTrackers,
      setCardsDropRef,
      isOverCards,
      setMainDropRef,
      isOverMain,
      statusIds,
      storyTagIds,
      storyThemeIds,
      cardIds,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
   };
}
