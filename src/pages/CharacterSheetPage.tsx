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
import { DndContext, DragOverlay } from '@dnd-kit/core';
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
import { SidebarMenu } from '@/components/organisms/SidebarMenu';
import { CharacterLoadDropZone } from '@/components/organisms/CharacterLoadDropzone';
import { SettingsDialog } from '@/components/organisms/dialogs/SettingsDialog';
import { InfoDialog } from '@/components/organisms/dialogs/InfoDialog';
import MainMenu from '@/components/organisms/MainMenu';
import MobileCharacterSheetPage from '@/components/mobile/character-sheet/MobileCharacterSheetPage';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
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
      overDragId,
      isOverDrawer,
      statusIds,
      storyTagIds,
      storyThemeIds,
      cardIds,
      handleDragStart,
      handleDragOver,
      handleDragEnd,
   } = useCharacterSheetDnD();


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


   return (
      <DndContext onDragOver={handleDragOver} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={customCollisionDetection}>
         <div className="flex bg-background text-foreground" style={{ height: '100%', width: '100dvw' }}>
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
            <DragOverlayContent
               activeDragItem={activeDragItem}
               isEditing={isEditing}
               isCompactDrawer={isCompactDrawer}
            />
         </DragOverlay>
      </DndContext>
   );
}

export default function CharacterSheetPage() {
   const { isMobile } = useDeviceType();

   if (isMobile) {
      return <MobileCharacterSheetPage />;
   }

   return <DesktopCharacterSheetPage />;
}