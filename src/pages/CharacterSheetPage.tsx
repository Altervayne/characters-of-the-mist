// -- React Imports --
import React from 'react';
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
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Download, PlusCircle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { customCollisionDetection } from '@/lib/utils/dnd';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- DnD Component Imports --
import { Sortable, DragLayoutWrapper } from '@/components/dnd';

// -- Component Imports --
import { CommandPalette } from '@/components/organisms/command-palette/CommandPalette';
import { LegendsThemeCard } from '@/components/organisms/cards/LegendsThemeCard';
import { CityThemeCard } from '@/components/organisms/cards/CityThemeCard';
import { OtherscapeThemeCard } from '@/components/organisms/cards/OtherscapeThemeCard';
import { HeroCard } from '@/components/organisms/cards/HeroCard';
import { RiftCard } from '@/components/organisms/cards/RiftCard';
import { OtherscapeCharacterCard } from '@/components/organisms/cards/OtherscapeCharacterCard';
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { AddCardButton } from '@/components/molecules/AddThemeCardButton';
import { CreateCardDialog } from '@/components/organisms/dialogs/CreateCardDialog';
import { CompactItemEntry, Drawer } from '@/components/organisms/drawer/Drawer';
import { DrawerItemPreview, FolderPreview } from '@/components/organisms/drawer/DrawerItemPreview';
import { SidebarMenu } from '@/components/organisms/SidebarMenu';
import { CharacterLoadDropZone } from '@/components/organisms/CharacterLoadDropzone';
import { SettingsDialog } from '@/components/organisms/dialogs/SettingsDialog';
import { InfoDialog } from '@/components/organisms/dialogs/InfoDialog';
import MainMenu from '@/components/organisms/MainMenu';
import MobileCharacterSheetPage from '@/components/mobile/MobileCharacterSheetPage';

// -- Store and Hook Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppGeneralStateActions, useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { useAppTourDriver } from '@/hooks/useAppTourDriver';

// -- Type Imports --
import type { Card as CardData } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';



interface CardRendererProps {
   card: CardData;
   isEditing: boolean;
   isSnapshot?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onEditCard?: () => void;
   onExport?: () => void;
}

const CardRenderer = React.memo(
   React.forwardRef<HTMLDivElement, CardRendererProps>(
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
   })
);
CardRenderer.displayName = 'CardRenderer';



function DesktopCharacterSheetPage() {
   // --- Localization ---
   const { t: t } = useTranslation();
   const { t: tTrackers } = useTranslation();

   // --- Data Stores ---
   const character = useCharacterStore((state) => state.character);
   const { updateCharacterName, addStatus, addStoryTag } = useCharacterActions();
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

   // --- Drag and Drop ---
   const {
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
                                             className={cn("cursor-pointer flex items-center justify-center w-55 h-25",
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
                                             className={cn("cursor-pointer flex items-center justify-center w-55 min-h-13.75 py-2",
                                                            "rounded-lg border-2 border-dashed border-bg text-bg border-primary/25 text-muted-foreground bg-primary/5",
                                                            "hover:text-foreground hover:border-foreground"
                                             )}
                                          >
                                             <PlusCircle className="mr-2 h-4 w-4 shrink-0" />
                                             <span className="text-center whitespace-normal">{tTrackers('Trackers.addStoryTag')}</span>
                                          </Button>
                                       )}
                                    </div>
                                 </SortableContext>
                              </div>

                              <div 
                                 className="shrink-0 max-w-[45%]"
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

export default function CharacterSheetPage() {
   const { isMobile } = useDeviceType();

   if (isMobile) {
      return <MobileCharacterSheetPage />;
   }

   return <DesktopCharacterSheetPage />;
}