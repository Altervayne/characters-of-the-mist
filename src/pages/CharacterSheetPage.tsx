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
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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
import { DragCursorPuck } from '@/components/molecules/DragCursorPuck';
import { CreateCardDialog } from '@/components/organisms/dialogs/CreateCardDialog';
import { Drawer } from '@/components/organisms/drawer/Drawer';
import { SidebarMenu } from '@/components/organisms/SidebarMenu';
import { TabStrip } from '@/components/organisms/tabs/TabStrip';
import { TabDragPreview } from '@/components/organisms/tabs/TabDragPreview';
import { CharacterLoadDropZone } from '@/components/organisms/CharacterLoadDropzone';
import { SettingsDialog } from '@/components/organisms/dialogs/SettingsDialog';
import { InfoDialog } from '@/components/organisms/dialogs/InfoDialog';
import MainMenu from '@/components/organisms/MainMenu';
import MobileCharacterSheetPage from '@/components/mobile/character-sheet/MobileCharacterSheetPage';
import { CharacterBootLoading } from '@/components/molecules/CharacterBootLoading';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
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
   const isBootHydrating = useIsBootHydrating();
   const { updateCharacterName, addStatus, addStoryTag } = useCharacterActions();
   const isCompactDrawer = useAppSettingsStore((state) => state.isCompactDrawer);

   // ==================
   //  General App Stores
   // ==================
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

   // ==================
   //  Drag and Drop
   // ==================
   const {
      activeDragItem,
      activeTabDrag,
      overDragId,
      isOverDrawer,
      statusIds,
      storyTagIds,
      storyThemeIds,
      cardIds,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
      handleDragCancel,
      cursorRef,
      dragContext,
      isOverTabLane,
      springTarget,
   } = useCharacterSheetDnD();

   // The cursor puck mounts for the whole drag (so its node — and thus the imperative
   // position writes — stay stable), morphing its content with `dragContext`.
   const isDragActive = activeDragItem !== null || activeTabDrag !== null;

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


   // Boot loading gate (spec §5, C-4): while the active character is still being
   // read from IndexedDB, show a neutral loading screen rather than flashing the
   // main menu before the sheet resolves. All hooks above run unconditionally.
   if (isBootHydrating && !character) {
      return <CharacterBootLoading />;
   }

   return (
      <DndContext sensors={sensors} onDragOver={handleDragOver} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} collisionDetection={customCollisionDetection}>
         <div className="flex bg-background text-foreground" style={{ height: '100dvh', width: '100dvw' }}>
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

               {/* Multi-character tab strip (desktop top bar, tabs spec §5) */}
               <TabStrip forceDropHighlight={isOverTabLane} />

               {/* Content area: own positioning context for the absolutely-filled
                   sheet/menu so they sit below the strip rather than over it. */}
               <div className="relative flex-1 min-h-0">
                  { character ? (
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
                              />

                              <CardsSection
                                 character={character}
                                 isEditing={isEditing}
                                 onExport={handleExportComponent}
                                 onEditCard={handleEditCard}
                                 onAddCard={handleAddCardClick}
                                 cardIds={cardIds}
                              />
                           </SheetMainDropZone>
                        </div>
                     </main>
                  )           : (
                     <MainMenu />
                  )}


                  {/* Character from Drawer Drop Zone */}
                  <CharacterLoadDropZone activeDragItem={activeDragItem} />

                  {/* File Drop Zone */}
                  <FileDragOverlay isDragActive={isFileDragActive} />
               </div>
            </div>

            {/* Drawer */}
            <AnimatePresence>
               {isDrawerOpen &&
                  <Drawer
                     isDragHovering={isOverDrawer}
                     activeDragId={activeDragItem?.id ?? null}
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


         <DragOverlay>
            {activeTabDrag ? (
               <TabDragPreview tab={activeTabDrag} />
            ) : (
               <DragOverlayContent
                  activeDragItem={activeDragItem}
                  isEditing={isEditing}
                  isCompactDrawer={isCompactDrawer}
               />
            )}
         </DragOverlay>

         {/* Context cursor-puck — a SIBLING of <DragOverlay> (never a child: the
             overlay's transform would offset this fixed element). Mounted for the
             whole drag so the hook's per-frame position writes hit a stable node. */}
         {isDragActive && <DragCursorPuck ref={cursorRef} context={dragContext} />}
      </DndContext>
   );
}

export default function CharacterSheetPage() {
   const { isMobile } = useDeviceType();

   // The ActiveCharacterStoreProvider is mounted in App.tsx (above
   // AppStartManagerProvider, which also consumes the store), so it already covers
   // both shells here — no provider needed at this level (tabs spec §1.2, §6).
   if (isMobile) {
      return <MobileCharacterSheetPage />;
   }

   return <DesktopCharacterSheetPage />;
}