// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Custom Hooks --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useCharacterSheetDnD } from '@/hooks/character-sheet/useCharacterSheetDnD';
import { useCharacterSheetFileImport } from '@/hooks/character-sheet/useCharacterSheetFileImport';
import { useCharacterSheetExport } from '@/hooks/character-sheet/useCharacterSheetExport';
import { useCharacterSheetUndoRedo } from '@/hooks/character-sheet/useCharacterSheetUndoRedo';
import { useCardDialogState } from '@/hooks/character-sheet/useCardDialogState';

// -- Other Library Imports --
import { DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';

// -- Utils Imports --
import { customCollisionDetection } from '@/lib/utils/dnd';

// -- Component Imports --
import { CommandPalette } from '@/components/organisms/command-palette/CommandPalette';
import { TrackersSection } from '@/components/organisms/TrackersSection';
import { CardsSection } from '@/components/organisms/CardsSection';
import { SheetMainDropZone } from '@/components/organisms/SheetMainDropZone';
import { CharacterNameHeader } from '@/components/molecules/CharacterNameHeader';
import { FileDragOverlay } from '@/components/molecules/FileDragOverlay';
import { DragOverlayContent } from '@/components/molecules/DragOverlayContent';
import { CreateCardDialog } from '@/components/organisms/dialogs/CreateCardDialog';
import { Drawer } from '@/components/organisms/drawer/Drawer';
import { ExpandedDrawer } from '@/components/organisms/drawer/ExpandedDrawer';
import { SidebarMenu } from '@/components/organisms/SidebarMenu';
import { TabStrip } from '@/components/organisms/tabs/TabStrip';
import { TabDragPreview } from '@/components/organisms/tabs/TabDragPreview';
import { BoardView } from '@/components/organisms/board/BoardView';
import { CharacterLoadDropZone } from '@/components/organisms/CharacterLoadDropzone';
import { CannotDropOverlay } from '@/components/organisms/CannotDropOverlay';
import { SettingsDialog } from '@/components/organisms/dialogs/SettingsDialog';
import { InfoDialog } from '@/components/organisms/dialogs/InfoDialog';
import MainMenu from '@/components/organisms/MainMenu';
import MobileCharacterSheetPage from '@/components/mobile/character-sheet/MobileCharacterSheetPage';
import { CharacterBootLoading } from '@/components/molecules/CharacterBootLoading';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';
import { useIsBootHydrating } from '@/lib/character/characterPersistence';
import { useAppGeneralStateActions, useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { useAppTourDriver } from '@/hooks/useAppTourDriver';

function DesktopCharacterSheetPage() {
   // ==================
   //  Localization
   // ==================
   const { t: t } = useTranslation();

   // ==================
   //  Data Stores
   // ==================
   const character = useCharacterStore((state) => state.character);
   // The active board context is the surface switch: non-null under a board tab, null
   // under a character tab or the menu. It already answers "is a board active?", so the
   // page never re-derives the active tab type.
   const activeBoard = useActiveBoardInstance();
   const isBootHydrating = useIsBootHydrating();
   const { updateCharacterName, addStatus, addStoryTag, addPortrait } = useCharacterActions();
   const isCompactDrawer = useAppSettingsStore((state) => state.isCompactDrawer);

   // ==================
   //  General App Stores
   // ==================
   const isTrackersAlwaysEditable = useAppSettingsStore((state) => state.isTrackersAlwaysEditable)
   const isDrawerOpen = useAppGeneralStateStore((state) => state.isDrawerOpen);
   const isDrawerExpanded = useAppGeneralStateStore((state) => state.isDrawerExpanded);
   const isSidebarCollapsed = useAppSettingsStore((state) => state.isSidebarCollapsed);
   const isEditing = useAppGeneralStateStore((state) => state.isEditing);
   const isSettingsOpen = useAppGeneralStateStore((state) => state.isSettingsOpen);
   const isInfoOpen = useAppGeneralStateStore((state) => state.isInfoOpen);
   const isTourOpen = useAppGeneralStateStore((state) => state.isInfoOpen);
   const { setDrawerOpen, setIsEditing, setSettingsOpen, setInfoOpen, setPatchNotesOpen } = useAppGeneralStateActions();
   const { setSidebarCollapsed, toggleSidebarCollapsed } = useAppSettingsActions();

   const areTrackersEditable = isEditing || isTrackersAlwaysEditable;

   // ==================
   //  Drag and Drop
   // ==================
   const {
      activeDragItem,
      activeTabDrag,
      overDragId,
      isOverDrawer,
      drawerDropTarget,
      statusIds,
      storyTagIds,
      storyThemeIds,
      cardIds,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      isOverTabLane,
      springTarget,
      sheetHighlight,
      isIncompatibleComponentDrag,
      renderClone,
      renderCluster,
   } = useCharacterSheetDnD();

   // One sensor config for every sheet drag (tabs, cards, trackers, drawer). The 5px
   // activation distance lets a tab single-click still activate/close while a drag
   // past the threshold reorders; the KeyboardSensor preserves the default a11y drag.
   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor),
   );


   // #########################################
   // ###   CARD CREATION DIALOG HANDLERS   ###
   // #########################################

   const {
      isCardDialogOpen,
      setCardDialogOpen,
      dialogMode,
      cardToEdit,
      handleEditCard,
      handleAddCardClick,
      handleDialogConfirm,
   } = useCardDialogState();


   // ########################################
   // ###   IMPORT/EXPORT LOGIC HANDLERS   ###
   // ########################################

   const { handleExportComponent } = useCharacterSheetExport();

   const { getRootProps, isDragActive: isFileDragActive } = useCharacterSheetFileImport();


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

   useCharacterSheetUndoRedo(isDrawerOpen);


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


   // While the active character is still being read from IndexedDB, show a neutral
   // loading screen rather than flashing the main menu before the sheet resolves.
   // All hooks above run unconditionally.
   if (isBootHydrating && !character) {
      return <CharacterBootLoading />;
   }

   return (
      <DndContext sensors={sensors} onDragOver={handleDragOver} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={customCollisionDetection} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
         <div className="flex bg-background text-foreground" style={{ height: '100dvh', width: '100dvw' }}>
            <SidebarMenu 
               isEditing={isEditing}
               isDrawerOpen={isDrawerOpen}
               isCollapsed={isSidebarCollapsed}
               activeWindow={ activeBoard ? 'BOARD' : (character ? 'PLAY_AREA' : 'MAIN_MENU') }
               onToggleEditing={() => setIsEditing(!isEditing)}
               onToggleDrawer={() => setDrawerOpen(!isDrawerOpen)}
               onToggleCollapse={toggleSidebarCollapsed}
               onOpenSettings={() => setSettingsOpen(true)}
               onOpenInfo={() => setInfoOpen(true)}
               onOpenPatchNotes={() => setPatchNotesOpen(true)}
            />

            {/* Character Sheet Area. `min-w-0` caps this flex item to its allocation so
                the tab strip scrolls instead of growing the item and pushing the
                sidebar/drawer off-screen. */}
            <div {...getRootProps()} className="relative w-full h-full flex-1 min-w-0 flex flex-col">

               {/* Multi-character tab strip (desktop top bar) */}
               <TabStrip forceDropHighlight={isOverTabLane} />

               {/* Content area: own positioning context for the absolutely-filled
                   sheet/menu so they sit below the strip rather than over it. */}
               <div className="relative flex-1 min-h-0">
                  { activeBoard ? (
                     <BoardView />
                  ) : character ? (
                     <main data-tour="character-sheet" className="absolute w-full h-full flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
                        <CharacterNameHeader
                           value={localName}
                           onChange={setLocalName}
                           placeholder={t('CharacterSheetPage.characterNamePlaceholder')}
                        />

                        <div className="flex-1 p-4 md:p-8">
                           <SheetMainDropZone>
                              <TrackersSection
                                 character={character}
                                 isEditing={isEditing}
                                 areTrackersEditable={areTrackersEditable}
                                 onExport={handleExportComponent}
                                 onAddStatus={addStatus}
                                 onAddStoryTag={addStoryTag}
                                 statusIds={statusIds}
                                 storyTagIds={storyTagIds}
                                 storyThemeIds={storyThemeIds}
                                 isDropTarget={sheetHighlight === 'trackers'}
                              />

                              <CardsSection
                                 character={character}
                                 isEditing={isEditing}
                                 onExport={handleExportComponent}
                                 onEditCard={handleEditCard}
                                 onAddCard={handleAddCardClick}
                                 onAddPortrait={addPortrait}
                                 cardIds={cardIds}
                                 isDropTarget={sheetHighlight === 'cards'}
                              />
                           </SheetMainDropZone>
                        </div>
                     </main>
                  )           : (
                     <MainMenu />
                  )}


                  {/* Character from Drawer Drop Zone */}
                  <CharacterLoadDropZone activeDragItem={activeDragItem} isBoardActive={!!activeBoard} />

                  {/* "Can't drop here" overlay for an incompatible (wrong-game) component */}
                  <CannotDropOverlay active={isIncompatibleComponentDrag} />

                  {/* File Drop Zone */}
                  <FileDragOverlay isDragActive={isFileDragActive} />
               </div>

               {/* Expanded drawer: an overlay over the workspace area (TabStrip + sheet/board stay mounted
                   behind it; the sidebar is outside this column, so it stays visible). */}
               {isDrawerExpanded && <ExpandedDrawer />}
            </div>

            {/* Drawer (Open side panel). Hidden while Expanded - the takeover renders in the workspace column. */}
            <AnimatePresence>
               {isDrawerOpen && !isDrawerExpanded &&
                  <Drawer
                     isDragHovering={isOverDrawer}
                     activeDragId={activeDragItem?.id ?? null}
                     drawerDropTarget={drawerDropTarget}
                     overDragId={overDragId}
                     springTargetId={springTarget}
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


         {/* Reorders apply immediately, so disable the drop-back animation. */}
         <DragOverlay dropAnimation={null}>
            {renderClone(
               activeTabDrag ? (
                  <TabDragPreview tab={activeTabDrag} />
               ) : (
                  <DragOverlayContent
                     activeDragItem={activeDragItem}
                     isEditing={isEditing}
                     isCompactDrawer={isCompactDrawer}
                  />
               ),
            )}
         </DragOverlay>

         {/* Cursor cluster as a SIBLING of <DragOverlay> (never a child: the overlay's
             transform would offset this fixed element). */}
         {renderCluster()}
      </DndContext>
   );
}

export default function CharacterSheetPage() {
   const { isMobile } = useDeviceType();

   // The ActiveCharacterStoreProvider is mounted in App.tsx (above
   // AppStartManagerProvider, which also consumes the store), so it already covers
   // both shells here; no provider needed at this level.
   if (isMobile) {
      return <MobileCharacterSheetPage />;
   }

   return <DesktopCharacterSheetPage />;
}