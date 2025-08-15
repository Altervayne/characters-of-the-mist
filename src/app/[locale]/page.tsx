'use client';

// -- React Imports --
import React, { useState, useEffect, useCallback } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import toast from 'react-hot-toast';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDroppable, DragOverEvent, DraggableAttributes } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

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

// -- Component Imports --
import { CommandPalette } from '@/components/organisms/command-palette';
import { LegendsThemeCard } from '@/components/organisms/legends-theme-card';
import { HeroCard } from '@/components/organisms/hero-card';
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
import { Character, Card as CardData, Tracker, LegendsThemeDetails, LegendsHeroDetails } from '@/lib/types/character';
import { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';
import { CreateCardOptions } from '@/lib/types/creation';



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
      const t = useTranslations('CardRenderer');
      const commonProps = { ref, isEditing, isSnapshot, dragAttributes, dragListeners, onEditCard, onExport };

      if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME') {
         return <LegendsThemeCard card={card} {...commonProps} />;
      }
      if (card.cardType === 'CHARACTER_CARD') {
         return <HeroCard card={card} {...commonProps} />;
      }
      return <div ref={ref} className="h-[300px] w-[250px] bg-card text-card-foreground border-2 rounded-lg flex items-center justify-center">{t('listCardPlaceholder', { title: card.title })}</div>;
});
CardRenderer.displayName = 'CardRenderer';



function SortableCardItem({ card, isEditing, isBeingDragged, onEditCard, onExport }: { card: CardData; isEditing: boolean; isBeingDragged: boolean; onEditCard: () => void; onExport: () => void; }) {
   const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
      id: card.id,
      data: {
         type: 'sheet-card',
         item: card,
      }
   });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
   };

   return (
      <div ref={setNodeRef} style={style}>
         <motion.div
            layout
            animate={{ opacity: isBeingDragged ? 0.4 : 1 }}
            transition={{ duration: 0.2 }}
         >
            <CardRenderer card={card} isEditing={isEditing} dragAttributes={attributes} dragListeners={listeners} onEditCard={onEditCard} onExport={onExport} />
         </motion.div>
      </div>
   );
}

function SortableTrackerItem({ tracker, isEditing, isBeingDragged, onExport }: { tracker: Tracker; isEditing: boolean; isBeingDragged: boolean; onExport: () => void; }) {
   const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
      id: tracker.id,
      data: {
         type: 'sheet-tracker',
         item: tracker,
      }
   });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
   };

   return (
      <div ref={setNodeRef} style={style}>
         <motion.div
            layout
            animate={{ opacity: isBeingDragged ? 0.4 : 1 }}
            transition={{ duration: 0.2 }}
         >
            {tracker.trackerType === 'STATUS' && <StatusTrackerCard tracker={tracker} isEditing={isEditing} dragAttributes={attributes} dragListeners={listeners} onExport={onExport} />}
            {tracker.trackerType === 'STORY_TAG' && <StoryTagTrackerCard tracker={tracker} isEditing={isEditing} dragAttributes={attributes} dragListeners={listeners} onExport={onExport} />}
            {tracker.trackerType === 'STORY_THEME' && <StoryThemeTrackerCard tracker={tracker} isEditing={isEditing} dragAttributes={attributes} dragListeners={listeners} onExport={onExport} />}
         </motion.div>
      </div>
   );
}



export default function CharacterSheetPage() {
   // --- Localization ---
   const t = useTranslations('CharacterSheetPage');
   const tNotifications = useTranslations('Notifications')
   const tTrackers = useTranslations('Trackers');

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
   const { setSidebarCollapsed, toggleSidebarCollapsed } = useAppSettingsActions();

   const areTrackersEditable = isEditing || isTrackersAlwaysEditable;

   // --- Utility & Library States ---
   const [isClient, setIsClient] = useState(false);
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
         toast.success(tNotifications('card.updated'));
      } else {
         addCard(options);
         toast.success(tNotifications('card.created'));
      }
   };



   // #################################
   // ###   PAGE STARTUP HANDLERS   ###
   // #################################

   useEffect(() => {
      setIsClient(true);
   }, []);

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
         toast.error(tNotifications('general.invalidExportType'));
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
      toast.success(tNotifications('general.exportSuccess'));
   };

   const onFileDrop = useCallback(async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file || !character) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);
         const { fileType, game } = importedData;

         // --- Full character sheet ---
         if (fileType === 'FULL_CHARACTER_SHEET') {
            loadCharacter(migratedContent as Character);
            toast.success(tNotifications('character.imported'));
            return;
         }

         // --- Compatibility check for individual components ---
         if (game !== character.game) {
            toast.error(tNotifications('general.importFailed'));
            return;
         }

         const isCardType = fileType === 'CHARACTER_CARD' || fileType === 'CHARACTER_THEME' || fileType === 'GROUP_THEME';
         const isTrackerType = fileType === 'STATUS_TRACKER' || fileType === 'STORY_TAG_TRACKER' || fileType === 'STORY_THEME_TRACKER';

         if (isCardType) {
            addImportedCard(migratedContent as CardData);
            toast.success(tNotifications('character.componentImported'));
         } else if (isTrackerType) {
            addImportedTracker(migratedContent as Tracker);
            toast.success(tNotifications('character.componentImported'));
         } else {
            toast.error(tNotifications('general.importFailed'));
         }

      } catch (error) {
         console.error("Failed to import file:", error);
         toast.error(tNotifications('general.importFailed'));
      }
   }, [character, loadCharacter, addImportedCard, addImportedTracker, tNotifications]);

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

   function handleDragStart(event: DragStartEvent) {
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
   };

   function handleDragOver(event: DragOverEvent) {
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
   };

   function handleDragEnd(event: DragEndEvent) {
      const { active, over } = event;

      setActiveDragItem(null);
      setIsOverDrawer(false);
      setOverDragId(null);

      if (!character || !over || active.id === over.id) {
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
               loadCharacter(draggedItem.content as Character);
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
         const isOverSheet = overIdStr === 'character-sheet-main-drop-zone' ||
                              overIdStr === 'tracker-drop-zone' ||
                              overIdStr === 'card-drop-zone' ||
                              overType === 'sheet-card' ||
                              overType === 'sheet-tracker';

         console.log('Drop target:', overIdStr, 'Drop type:', overType, 'Is over sheet:', isOverSheet);

         if (isOverSheet) {
            if (activeType !== 'drawer-item') return;

            const draggedItem = active.data.current?.item as DrawerItem;
            if (!draggedItem || draggedItem.game !== character.game) return;

            console.log('Dragged item:', draggedItem.type);

            const isTrackerType = draggedItem.type === 'STATUS_TRACKER' || draggedItem.type === 'STORY_TAG_TRACKER' || draggedItem.type === 'STORY_THEME_TRACKER';
            const isCardType = draggedItem.type === 'CHARACTER_CARD' || draggedItem.type === 'CHARACTER_THEME' || draggedItem.type === 'GROUP_THEME';

            console.log('Is tracker:', isTrackerType, 'Is card:', isCardType);

            if (isTrackerType) {
               addImportedTracker(draggedItem.content as Tracker);
               toast.success(tNotifications('character.componentImported'));
            } else if (isCardType) {
               addImportedCard(draggedItem.content as CardData);
               toast.success(tNotifications('character.componentImported'));
            } else {
               console.log('Drop rejected - unsupported item type:', draggedItem.type);
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
            if (!activeDragItem || active.data.current?.isDrawer) return;

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
            return;
         }

         // --- SCENARIO 2.2: Reordering ON the sheet ---
         if (overType?.startsWith('sheet-')) {
            const isCardDrag = activeType === 'sheet-card';
            const isStatusDrag = (active.data.current?.item as Tracker)?.trackerType === 'STATUS';
            const isStoryTagDrag = (active.data.current?.item as Tracker)?.trackerType === 'STORY_TAG';
            const isStoryThemeDrag = (active.data.current?.item as Tracker)?.trackerType === 'STORY_THEME';
            
            if (isCardDrag && overType === 'sheet-card') {
               const oldIndex = character.cards.findIndex(item => item.id === active.id);
               const newIndex = character.cards.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && newIndex !== -1) reorderCards(oldIndex, newIndex);
            } else if (isStatusDrag && (over.data.current?.item as Tracker)?.trackerType === 'STATUS') {
               const oldIndex = character.trackers.statuses.findIndex(item => item.id === active.id);
               const newIndex = character.trackers.statuses.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && newIndex !== -1) reorderStatuses(oldIndex, newIndex);
            } else if (isStoryTagDrag && (over.data.current?.item as Tracker)?.trackerType === 'STORY_TAG') {
               const oldIndex = character.trackers.storyTags.findIndex(item => item.id === active.id);
               const newIndex = character.trackers.storyTags.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && newIndex !== -1) reorderStoryTags(oldIndex, newIndex);
            } else if (isStoryThemeDrag && (over.data.current?.item as Tracker)?.trackerType === 'STORY_THEME') {
               const oldIndex = character.trackers.storyThemes.findIndex(item => item.id === active.id);
               const newIndex = character.trackers.storyThemes.findIndex(item => item.id === over.id);
               if (oldIndex !== -1 && newIndex !== -1) reorderStoryThemes(oldIndex, newIndex);
            }
         }
      }
   }



   // ##########################################
   // ###   CHARACTER NAME INPUT DEBOUNCER   ###
   // ##########################################

   const [localName, setLocalName] = useState(character?.name ?? '');

   useEffect(() => {
      if (!character) return;
      
      const handler = setTimeout(() => {
         if (character.name !== localName) {
            updateCharacterName(localName);
         }
      }, 500);

      return () => {
         clearTimeout(handler);
      };
   }, [localName, character, updateCharacterName]);

   useEffect(() => {
      if (character) {
         setLocalName(character.name);
      }
   }, [character?.name, character]);



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



   if (!isClient) {
      return (
         <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
            <p className="text-muted-foreground">{t('loading')}</p>
         </main>
      );
   }



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
                           placeholder={t('characterNamePlaceholder')}
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
                                 <SortableContext items={character.trackers.statuses.map(tracker => tracker.id)} strategy={rectSortingStrategy}>
                                    <div className="flex flex-wrap gap-4">
                                       {character.trackers.statuses.map(tracker => (
                                          <SortableTrackerItem
                                             key={tracker.id}
                                             tracker={tracker}
                                             isEditing={isEditing}
                                             isBeingDragged={activeDragItem?.id === tracker.id}
                                             onExport={() => handleExportComponent(tracker)}
                                          />
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
                                             {tTrackers('addStatus')}
                                          </Button>
                                       )}
                                    </div>
                                 </SortableContext>

                                 {/* Story Tags Group */}
                                 <SortableContext items={character.trackers.storyTags.map(tracker => tracker.id)} strategy={rectSortingStrategy}>
                                    <div className="flex flex-wrap gap-4">
                                       {character.trackers.storyTags.map(tracker => (
                                          <SortableTrackerItem
                                             key={tracker.id}
                                             tracker={tracker}
                                             isEditing={isEditing}
                                             isBeingDragged={activeDragItem?.id === tracker.id}
                                             onExport={() => handleExportComponent(tracker)}
                                          />
                                       ))}
                                       {areTrackersEditable && (
                                          <Button
                                             data-tour="add-story-tag-button" 
                                             variant="ghost" 
                                             onClick={() => addStoryTag()} 
                                             className={cn("cursor-pointer flex items-center justify-center w-[220px] h-[55px]",
                                                            "rounded-lg border-2 border-dashed border-bg text-bg border-primary/25 text-muted-foreground bg-primary/5",
                                                            "hover:text-foreground hover:border-foreground"
                                             )}
                                          >
                                             <PlusCircle className="mr-2 h-4 w-4" />
                                             {tTrackers('addStoryTag')}
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
                                 <SortableContext items={character.trackers.storyThemes.map(tracker => tracker.id)} strategy={rectSortingStrategy}>
                                    <div className="flex flex-wrap justify-end gap-4">
                                       {character.trackers.storyThemes.map(tracker => (
                                          <SortableTrackerItem
                                             key={tracker.id}
                                             tracker={tracker}
                                             isEditing={isEditing}
                                             isBeingDragged={activeDragItem?.id === tracker.id}
                                             onExport={() => handleExportComponent(tracker)}
                                          />
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
                              <SortableContext items={character.cards.map(card => card.id)} strategy={rectSortingStrategy}>
                                 {character.cards.map(card => (
                                    <SortableCardItem
                                       key={card.id}
                                       card={card}
                                       isEditing={isEditing}
                                       isBeingDragged={activeDragItem?.id === card.id}
                                       onEditCard={() => handleEditCard(card)}
                                       onExport={() => handleExportComponent(card)}
                                    />
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
                              {t('dropToImport')}
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