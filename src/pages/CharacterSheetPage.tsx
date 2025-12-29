

// -- React Imports --
import React, { useState, useEffect, useCallback, useMemo } from 'react';

// -- Custom Hooks --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent, DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Download, PlusCircle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { findFolder } from '@/lib/utils/drawer';
import { customCollisionDetection, mapItemToStorableInfo } from '@/lib/utils/dnd';
import { exportToFile, generateExportFilename, importFromFile } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';
import { DRAG_TYPES } from '@/lib/constants/drag-drop';

// -- DnD Component Imports --
import { Sortable, DragLayoutWrapper } from '@/components/dnd';

// -- Component Imports --
import { CommandPalette } from '@/components/organisms/command-palette';
import { LegendsThemeCard } from '@/components/organisms/legends-theme-card';
import { CityThemeCard } from '@/components/organisms/city-theme-card';
import { OtherscapeThemeCard } from '@/components/organisms/otherscape-theme-card';
import { HeroCard } from '@/components/organisms/hero-card';
import { RiftCard } from '@/components/organisms/rift-card';
import { OtherscapeCharacterCard } from '@/components/organisms/otherscape-character-card';
import { StatusTrackerCard } from '@/components/molecules/status-tracker';
import { StoryTagTrackerCard } from '@/components/molecules/story-tag-tracker';
import { StoryThemeTrackerCard } from '@/components/organisms/story-theme-tracker';
import { AddCardButton } from '@/components/molecules/add-theme-card-button';
import { CreateCardDialog } from '@/components/organisms/create-card-dialog';
import { CompactItemEntry, Drawer } from '@/components/organisms/drawer';
import { DrawerItemPreview, FolderPreview } from '@/components/molecules/drawer-item-preview';
import { SidebarMenu } from '@/components/organisms/sidebar-menu';
import { CharacterLoadDropZone } from '@/components/organisms/character-load-dropzone';
import { SettingsDialog } from '@/components/organisms/settings-dialog';
import { InfoDialog } from '@/components/organisms/info-dialog';
import MainMenu from '@/components/organisms/main-menu';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useDrawerActions, useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateActions, useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { useAppTourDriver } from '@/hooks/useAppTourDriver';

// -- Type Imports --
import type { Character, Card as CardData, Tracker, LegendsThemeDetails, LegendsHeroDetails } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';
import type { CreateCardOptions } from '@/lib/types/creation';



interface CardRendererProps {
   card: CardData;
   isEditing: boolean;
   isSnapshot?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onEditCard?: () => void;
   onExport?: () => void;
}

const CardRenderer = React.forwardRef<HTMLDivElement, CardRendererProps>(
  ({ card, isEditing, isSnapshot, dragAttributes, dragListeners, onEditCard, onExport }, ref) => {
      const commonProps = { ref, isEditing, isSnapshot, dragAttributes, dragListeners, onEditCard, onExport };

      if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME' || card.cardType === 'LOADOUT_THEME') {
         if (card.details.game === 'LEGENDS') {
            return <LegendsThemeCard card={card} {...commonProps} />;
         } else if (card.details.game === 'CITY_OF_MIST') {
            return <CityThemeCard card={card} {...commonProps} />;
         } else if (card.details.game === 'OTHERSCAPE') {
            return <OtherscapeThemeCard card={card} {...commonProps} />;
         }
      }
      if (card.cardType === 'CHARACTER_CARD') {
         if (card.details.game === 'LEGENDS') {
            return <HeroCard card={card} {...commonProps} />;
         } else if (card.details.game === 'CITY_OF_MIST') {
            return <RiftCard card={card} {...commonProps} />;
         } else if (card.details.game === 'OTHERSCAPE') {
            return <OtherscapeCharacterCard card={card} {...commonProps} />;
         }
      }

      return <div ref={ref} className="h-75 w-62.5 bg-card overflow-hidden text-card-foreground border-2 rounded-lg flex items-center justify-center">
               <p className='w-full text-wrap text-center'>{`NO RENDER AVAILABLE FOR THIS TYPE: ${card.details.game} ${card.cardType}`}</p>
            </div>;
});
CardRenderer.displayName = 'CardRenderer';



export default function CharacterSheetPage() {
   // --- Localization ---
   const { t: t } = useTranslation();
   const { t: tNotifications } = useTranslation();
   const { t: tTrackers } = useTranslation();

   // --- Data Stores ---
   const character = useCharacterStore((state) => state.character);
   const { loadCharacter, addCard, updateCardDetails, reorderCards, updateCharacterName, addStatus, addStoryTag,
            reorderStatuses, reorderStoryTags, reorderStoryThemes, addImportedCard, addImportedTracker } = useCharacterActions();
   const drawer = useDrawerStore((state) => state.drawer);
   const { initiateItemDrop, moveFolder, reorderFolders, moveItem, reorderItems } = useDrawerActions();
   const isCompactDrawer = useAppSettingsStore((state) => state.isCompactDrawer);

   // --- General App Stores ---
   const isTrackersAlwaysEditable = useAppSettingsStore((state) => state.isTrackersAlwaysEditable)
   const isDrawerOpen = useAppGeneralStateStore((state) => state.isDrawerOpen);
   const isSidebarCollapsed = useAppSettingsStore((state) => state.isSidebarCollapsed);
   const isEditing = useAppGeneralStateStore((state) => state.isEditing);
   const isSettingsOpen = useAppGeneralStateStore((state) => state.isSettingsOpen);
   const isInfoOpen = useAppGeneralStateStore((state) => state.isInfoOpen);
   const isTourOpen = useAppGeneralStateStore((state) => state.isInfoOpen);
   const { setDrawerOpen, setIsEditing, setSettingsOpen, setInfoOpen, setPatchNotesOpen } = useAppGeneralStateActions();
   const { setSidebarCollapsed, toggleSidebarCollapsed, setContextualGame } = useAppSettingsActions();

   const areTrackersEditable = isEditing || isTrackersAlwaysEditable;

   // --- Utility & Library States ---
   const [isOverDrawer, setIsOverDrawer] = useState(false);
   const [activeDragItem, setActiveDragItem] = useState<CardData | Tracker | DrawerItem | FolderType | null>(null);
   const [overDragId, setOverDragId] = useState<string | null>(null);

   

   // #########################################
   // ###   CARD CREATION DIALOG HANDLERS   ###
   // #########################################

   const isCardDialogOpen = useAppGeneralStateStore((state) => state.isCardDialogOpen);
   const { setCardDialogOpen } = useAppGeneralStateActions();
   const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
   const [cardToEdit, setCardToEdit] = useState<CardData | null>(null);

   const handleEditCard = (card: CardData) => {
      setDialogMode('edit');
      setCardToEdit(card);
      setCardDialogOpen(true);
   };

   const handleAddCardClick = () => {
      setDialogMode('create');
      setCardToEdit(null);
      setCardDialogOpen(true);
   };

   const handleDialogConfirm = (options: CreateCardOptions, cardId?: string) => {
      if (dialogMode === 'edit' && cardId) {
         updateCardDetails(cardId, { themebook: options.themebook, themeType: options.themeType });
         toast.success(tNotifications('Notifications.card.updated'));
      } else {
         addCard(options);
         toast.success(tNotifications('Notifications.card.created'));
      }
   };



   // #################################
   // ###   PAGE STARTUP HANDLERS   ###
   // #################################

   useEffect(() => {
      const settingsStorageKey = 'characters-of-the-mist_app-settings';
      const settingsInStorage = localStorage.getItem(settingsStorageKey);

      if (!settingsInStorage) {
         console.log('App settings not found in storage. Initializing defaults.');
         useAppSettingsStore.setState(useAppSettingsStore.getState());
      }
   }, []);



   // ########################################
   // ###   IMPORT/EXPORT LOGIC HANDLERS   ###
   // ########################################

   const handleExportComponent = (item: CardData | Tracker) => {
      const storableInfo = mapItemToStorableInfo(item);
      
      if (!storableInfo) {
         toast.error(tNotifications('Notifications.general.invalidExportType'));
         return;
      }
      
      const [itemType, gameSystem] = storableInfo;
      let handle: string | undefined = 'title' in item ? item.title : item.name;
      if ('cardType' in item) {
         if (item.cardType === 'CHARACTER_THEME' || item.cardType === 'GROUP_THEME') {
            handle = (item.details as LegendsThemeDetails).mainTag.name;
         } else if (item.cardType === 'CHARACTER_CARD') {
            handle = (item.details as LegendsHeroDetails).characterName;
         }
      }

      const fileName = generateExportFilename(gameSystem, itemType, handle);
      exportToFile(item, itemType, gameSystem, fileName);
      toast.success(tNotifications('Notifications.general.exportSuccess'));
   };

   const onFileDrop = useCallback(async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);
         const { fileType, game } = importedData;

         // --- Full character sheet ---
         if (fileType === 'FULL_CHARACTER_SHEET') {
            const characterData = migratedContent as Character;
            loadCharacter(characterData);
            setContextualGame(characterData.game);
            toast.success(tNotifications('Notifications.character.imported'));
            return;
         }

         // --- Individual components require a character to be loaded ---
         if (!character) {
            toast.error(tNotifications('Notifications.general.importFailedNoCharacter'));
            return;
         }

         // --- Compatibility check for individual components ---
         if (game !== character.game) {
            toast.error(tNotifications('Notifications.general.importFailedWrongGame'));
            return;
         }

         const isCardType = fileType === 'CHARACTER_CARD' || fileType === 'CHARACTER_THEME' || fileType === 'GROUP_THEME' || fileType === 'LOADOUT_THEME';
         const isTrackerType = fileType === 'STATUS_TRACKER' || fileType === 'STORY_TAG_TRACKER' || fileType === 'STORY_THEME_TRACKER';

         if (isCardType) {
            addImportedCard(migratedContent as CardData);
            toast.success(tNotifications('Notifications.character.componentImported'));
         } else if (isTrackerType) {
            addImportedTracker(migratedContent as Tracker);
            toast.success(tNotifications('Notifications.character.componentImported'));
         } else {
            toast.error(tNotifications('Notifications.general.importFailed'));
         }

      } catch (error) {
         console.error("Failed to import file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
   }, [character, loadCharacter, addImportedCard, addImportedTracker, setContextualGame, tNotifications]);

   const { getRootProps, isDragActive: isFileDragActive } = useDropzone({
      onDrop: onFileDrop,
      noClick: true,
      noKeyboard: true,
      accept: { 'application/json': ['.cotm', '.json'] },
   });



   // ###############################
   // ###   DRAG LOGIC HANDLERS   ###
   // ###############################

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



   // ##########################################
   // ###   CHARACTER NAME INPUT DEBOUNCER   ###
   // ##########################################

   const [localName, setLocalName] = useInputDebouncer(
      character?.name ?? '',
      (value) => updateCharacterName(value)
   );



   // ##############################
   // ###   UNDO/REDO SHORTCUT   ###
   // ##############################

   const lastModifiedStore = useAppGeneralStateStore((state) => state.lastModifiedStore);
   
   useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         const { undo: undoCharacter, redo: redoCharacter, pastStates: pastStatesCharacter, futureStates: futureStatesCharacter } = useCharacterStore.temporal.getState();
         const { undo: undoDrawer, redo: redoDrawer, pastStates: pastStatesDrawer, futureStates: futureStatesDrawer } = useDrawerStore.temporal.getState();

         const isUndo = (event.ctrlKey || event.metaKey) && event.key === 'z';
         const isRedo = (event.ctrlKey || event.metaKey) && event.key === 'y';

         const characterCanUndo = pastStatesCharacter.length > 1
         const characterCanRedo = futureStatesCharacter.length > 0
         const drawerCanUndo = pastStatesDrawer.length > 1
         const drawerCanRedo = futureStatesDrawer.length > 0

         if (!isUndo && !isRedo) return;

         event.preventDefault();

         if (lastModifiedStore === 'drawer' && isDrawerOpen) {
            if (isUndo && drawerCanUndo) undoDrawer();
            if (isRedo && drawerCanRedo) redoDrawer();
         } else {
            if (isUndo && characterCanUndo) undoCharacter();
            if (isRedo && characterCanRedo) redoCharacter();
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
      };
   }, [lastModifiedStore, isDrawerOpen]);



   // ###########################
   // ###   COMMAND PALETTE   ###
   // ###########################

   const commands = useCommandPaletteActions({
      onToggleEditMode: () => setIsEditing(!isEditing),
      onToggleDrawer: () => setDrawerOpen(!isDrawerOpen),
      onOpenSettings: () => setSettingsOpen(true),
   });



   // ############################
   // ###   TUTORIAL HANDLER   ###
   // ############################

   const { startTour } = useAppTourDriver();

   const handleStartTour = () => {
      setSidebarCollapsed(false);
      setSettingsOpen(false);
      setDrawerOpen(false);
      startTour();
   };



   return (
      <DndContext onDragOver={handleDragOver} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={customCollisionDetection}>
         <div className="flex h-screen bg-background text-foreground">
            <SidebarMenu 
               isEditing={isEditing}
               isDrawerOpen={isDrawerOpen}
               isCollapsed={isSidebarCollapsed}
               activeWindow={ character ? 'PLAY_AREA' : 'MAIN_MENU' }
               onToggleEditing={() => setIsEditing(!isEditing)}
               onToggleDrawer={() => setDrawerOpen(!isDrawerOpen)}
               onToggleCollapse={toggleSidebarCollapsed}
               onOpenSettings={() => setSettingsOpen(true)}
               onOpenInfo={() => setInfoOpen(true)}
               onOpenPatchNotes={() => setPatchNotesOpen(true)}
            />

            {/* Character Sheet Area */}
            <div {...getRootProps()} className="relative w-full h-full flex-1 flex flex-col">
               
               { character ? (
                  <main data-tour="character-sheet" className="absolute w-full h-full flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
                     <header className="p-4 bg-popover border-b border-border">
                        <input
                           data-tour="character-name-input"
                           type="text"
                           value={localName}
                           onChange={(e) => setLocalName(e.target.value)}
                           className="text-2xl text-popover-foreground font-bold bg-transparent focus:outline-none w-full"
                           placeholder={t('CharacterSheetPage.characterNamePlaceholder')}
                        />
                     </header>

                     <div className="flex-1 p-4 md:p-8">
                        <div ref={setMainDropRef} className={cn(
                           "flex flex-col items-center gap-8 min-h-full",
                           {"bg-muted/30 rounded-lg border-2 border-primary border-dashed": isOverMain}
                        )}>
                           <div
                              data-tour="trackers-section"
                              ref={setTrackersDropRef}
                              className={cn(
                                 "flex gap-4",
                                 "w-full bg-muted/75 rounded-lg p-4 border-2 border-border transition-colors",
                                 { "border-primary shadow-lg": isOverTrackers }
                              )}
                           >
                              <div className="flex-1 min-w-0 space-y-4">
                                 {/* Statuses Group */}
                                 <SortableContext items={statusIds} strategy={rectSortingStrategy}>
                                    <div className="flex flex-wrap gap-4">
                                       {character.trackers.statuses.map(tracker => (
                                          <Sortable
                                             key={tracker.id}
                                             id={tracker.id}
                                             data={{ type: DRAG_TYPES.SHEET_TRACKER, item: tracker }}
                                          >
                                             {({ dragAttributes, dragListeners, isBeingDragged }) => (
                                                <DragLayoutWrapper isBeingDragged={isBeingDragged}>
                                                   <StatusTrackerCard
                                                      tracker={tracker}
                                                      isEditing={isEditing}
                                                      dragAttributes={dragAttributes}
                                                      dragListeners={dragListeners}
                                                      onExport={() => handleExportComponent(tracker)}
                                                   />
                                                </DragLayoutWrapper>
                                             )}
                                          </Sortable>
                                       ))}
                                       {areTrackersEditable && (
                                          <Button
                                             data-tour="add-status-button"
                                             variant="ghost"
                                             onClick={() => addStatus()}
                                             className={cn("cursor-pointer flex items-center justify-center w-[220px] h-[100px]",
                                                            "rounded-lg border-2 border-dashed text-bg border-primary/25 text-muted-foreground bg-primary/5",
                                                            "hover:text-foreground hover:border-foreground"
                                             )}
                                          >
                                             <PlusCircle className="mr-2 h-4 w-4" />
                                             {tTrackers('Trackers.addStatus')}
                                          </Button>
                                       )}
                                    </div>
                                 </SortableContext>

                                 {/* Story Tags Group */}
                                 <SortableContext items={storyTagIds} strategy={rectSortingStrategy}>
                                    <div className="flex flex-wrap gap-4">
                                       {character.trackers.storyTags.map(tracker => (
                                          <Sortable
                                             key={tracker.id}
                                             id={tracker.id}
                                             data={{ type: DRAG_TYPES.SHEET_TRACKER, item: tracker }}
                                          >
                                             {({ dragAttributes, dragListeners, isBeingDragged }) => (
                                                <DragLayoutWrapper isBeingDragged={isBeingDragged}>
                                                   <StoryTagTrackerCard
                                                      tracker={tracker}
                                                      isEditing={isEditing}
                                                      dragAttributes={dragAttributes}
                                                      dragListeners={dragListeners}
                                                      onExport={() => handleExportComponent(tracker)}
                                                   />
                                                </DragLayoutWrapper>
                                             )}
                                          </Sortable>
                                       ))}
                                       {areTrackersEditable && (
                                          <Button
                                             data-tour="add-story-tag-button"
                                             variant="ghost"
                                             onClick={() => addStoryTag()}
                                             title={tTrackers('Trackers.addStoryTag')}
                                             className={cn("cursor-pointer flex items-center justify-center w-[220px] min-h-[55px] py-2",
                                                            "rounded-lg border-2 border-dashed border-bg text-bg border-primary/25 text-muted-foreground bg-primary/5",
                                                            "hover:text-foreground hover:border-foreground"
                                             )}
                                          >
                                             <PlusCircle className="mr-2 h-4 w-4 flex-shrink-0" />
                                             <span className="text-center whitespace-normal">{tTrackers('Trackers.addStoryTag')}</span>
                                          </Button>
                                       )}
                                    </div>
                                 </SortableContext>
                              </div>

                              <div 
                                 className="flex-shrink-0 max-w-[45%]"
                                 style={{ 
                                    width: character.trackers.storyThemes.length >= 2 
                                       ? '520px'
                                       : 'auto'
                                 }}
                              >
                                 {/* Story Themes Group */}
                                 <SortableContext items={storyThemeIds} strategy={rectSortingStrategy}>
                                    <div className="flex flex-wrap justify-end gap-4">
                                       {character.trackers.storyThemes.map(tracker => (
                                          <Sortable
                                             key={tracker.id}
                                             id={tracker.id}
                                             data={{ type: DRAG_TYPES.SHEET_TRACKER, item: tracker }}
                                          >
                                             {({ dragAttributes, dragListeners, isBeingDragged }) => (
                                                <DragLayoutWrapper isBeingDragged={isBeingDragged}>
                                                   <StoryThemeTrackerCard
                                                      tracker={tracker}
                                                      isEditing={isEditing}
                                                      dragAttributes={dragAttributes}
                                                      dragListeners={dragListeners}
                                                      onExport={() => handleExportComponent(tracker)}
                                                   />
                                                </DragLayoutWrapper>
                                             )}
                                          </Sortable>
                                       ))}
                                    </div>
                                 </SortableContext>
                              </div>
                           </div>

                           <div
                              data-tour="cards-section"
                              ref={setCardsDropRef}
                              className={cn(
                                 "flex flex-wrap gap-12 justify-center w-full p-4 rounded-lg border-2 border-transparent transition-colors",
                                 { "border-primary bg-muted/50 shadow-inner": isOverCards }
                              )}
                           >
                              {/* Cards Group */}
                              <SortableContext items={cardIds} strategy={rectSortingStrategy}>
                                 {character.cards.map(card => (
                                    <Sortable
                                       key={card.id}
                                       id={card.id}
                                       data={{ type: DRAG_TYPES.SHEET_CARD, item: card }}
                                    >
                                       {({ dragAttributes, dragListeners, isBeingDragged }) => (
                                          <DragLayoutWrapper isBeingDragged={isBeingDragged}>
                                             <CardRenderer
                                                card={card}
                                                isEditing={isEditing}
                                                dragAttributes={dragAttributes}
                                                dragListeners={dragListeners}
                                                onEditCard={() => handleEditCard(card)}
                                                onExport={() => handleExportComponent(card)}
                                             />
                                          </DragLayoutWrapper>
                                       )}
                                    </Sortable>
                                 ))}
                              </SortableContext>
                              {isEditing && <AddCardButton onClick={handleAddCardClick} />}
                           </div>
                        </div>
                     </div>
                  </main>
               )           : (
                  <MainMenu />
               )}



               {/* Character from Drawer Drop Zone */}
               <CharacterLoadDropZone activeDragItem={activeDragItem} />

               {/* File Drop Zone */}
               <AnimatePresence>
                  {isFileDragActive && (
                     <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex items-center justify-center p-3 bg-card/80 backdrop-blur-sm"
                     >
                        <div className="flex flex-col items-center justify-center w-full h-full text-center p-12 border-4 border-dashed border-primary/30">
                           <Download className="mx-auto h-12 w-12 text-primary" />
                           <p className="mt-2 font-semibold text-foreground">
                              {t('CharacterSheetPage.dropToImport')}
                           </p>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
            
            {/* Drawer */}
            <AnimatePresence>
               {isDrawerOpen &&
                  <Drawer
                     isDragHovering={isOverDrawer}
                     activeDragId={activeDragItem?.id ?? null}
                     overDragId={overDragId} 
                  />
               }
            </AnimatePresence>
         </div>


         {/* DIALOGS START */}
         <CommandPalette
            commands={commands}
         />
         <CreateCardDialog
            isOpen={isCardDialogOpen}
            onOpenChange={setCardDialogOpen}
            onConfirm={handleDialogConfirm}
            mode={dialogMode}
            cardData={cardToEdit ?? undefined}
            modal={!isTourOpen}
            game={character?.game ?? 'LEGENDS'}
         />
         <SettingsDialog 
            isOpen={isSettingsOpen}
            onOpenChange={setSettingsOpen}
            onStartTour={handleStartTour}
         />
         <InfoDialog 
            isOpen={isInfoOpen}
            onOpenChange={setInfoOpen}
         />
         {/* DIALOGS END */}


         <DragOverlay>
            {activeDragItem && (
               <motion.div className="shadow-2xl rounded-lg">
                  {'folders' in activeDragItem ? (
                     <FolderPreview folder={activeDragItem as FolderType} />
                  ) : 'cardType' in activeDragItem ? (
                     <CardRenderer card={activeDragItem} isEditing={isEditing} isSnapshot={true}/>
                  ) : 'trackerType' in activeDragItem ? (
                     (activeDragItem.trackerType === 'STATUS') ? <StatusTrackerCard tracker={activeDragItem} isEditing={isEditing} /> :
                     (activeDragItem.trackerType === 'STORY_TAG') ? <StoryTagTrackerCard tracker={activeDragItem} isEditing={isEditing} /> :
                     <StoryThemeTrackerCard tracker={activeDragItem} isEditing={isEditing} />
                  ) : 'game' in activeDragItem ? (
                     isCompactDrawer ? (
                        <CompactItemEntry item={activeDragItem as DrawerItem} isPreview={true} />
                     ) : (
                        <DrawerItemPreview item={activeDragItem as DrawerItem} />
                     )
                  ) : null}
               </motion.div>
            )}
         </DragOverlay>
      </DndContext>
   );
}