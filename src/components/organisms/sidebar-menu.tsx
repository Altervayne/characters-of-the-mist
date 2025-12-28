// -- React Imports --
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// -- Icon Imports --
import { Edit, Dices, BookUser, Save, Download, Upload, Layers, Trash2, PanelLeftOpen, PanelLeftClose, Settings, Info, Newspaper, FileX, SaveAll } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { exportCharacterSheet, importFromFile } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';

// -- Component Imports --
import { CharacterUndoRedoControls } from '../molecules/character-undo-redo-controls';
import { SidebarButton } from '../molecules/sidebar-button';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Other Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';



type WindowTypes = 'MAIN_MENU' | 'PLAY_AREA';

interface SidebarMenuProps {
   isEditing: boolean;
   isDrawerOpen: boolean;
   isCollapsed: boolean;
   activeWindow: WindowTypes;
   onToggleEditing: () => void;
   onToggleDrawer: () => void;
   onToggleCollapse: () => void;
   onOpenSettings: () => void;
   onOpenInfo: () => void;
   onOpenPatchNotes: () => void;
}

const UNLOAD_TIMER_SECONDS = 3;



export function SidebarMenu({ isEditing, isDrawerOpen, isCollapsed, activeWindow, onToggleEditing, onToggleDrawer, onToggleCollapse, onOpenSettings, onOpenInfo, onOpenPatchNotes }: SidebarMenuProps) {
   const { t } = useTranslation();
   const { t: tNotifications } = useTranslation();

   const character = useCharacterStore((state) => state.character);
   const { loadCharacter, addImportedCard, addImportedTracker, resetCharacter, unloadCharacter } = useCharacterActions();
   const { updateItem, initiateItemDrop } = useDrawerActions();

   const characterImportInputRef = useRef<HTMLInputElement>(null);
   const characterFormRef = useRef<HTMLFormElement>(null);
   const componentImportInputRef = useRef<HTMLInputElement>(null);
   const componentFormRef = useRef<HTMLFormElement>(null);



   const handleSaveCharacterToDrawer = () => {
      if (!character) return;

      if (character.drawerItemId) {
         updateItem(character.drawerItemId, character);
         toast.success(tNotifications('Notifications.character.savedToDrawer'));
      } else {
         handleSaveCharacterAsToDrawer();
      }
   };

   const handleSaveCharacterAsToDrawer = () => {
      if (!character) return;

      const newItemId = cuid();
      console.log('[SaveAs...] 1. Generated newItemId:', newItemId);
      
      const characterWithDrawerId = { ...character, drawerItemId: newItemId };
      console.log('[SaveAs...] 2. characterWithDrawerId has drawerItemId?', !!characterWithDrawerId.drawerItemId);

      loadCharacter(character, newItemId);
      
      // Give the store a tick to update
      setTimeout(() => {
         const storeChar = useCharacterStore.getState().character;
         console.log('[SaveAs...] 3. After loadCharacter, store has drawerItemId?', storeChar?.drawerItemId);
      }, 0);

      if (!isDrawerOpen) {
         onToggleDrawer();
      }
      
      initiateItemDrop({
         game: character.game,
         type: 'FULL_CHARACTER_SHEET',
         content: characterWithDrawerId,
         defaultName: character.name,
         presetId: newItemId
      });
      
      console.log('[SaveAs...] 4. Pending item presetId:', newItemId);
   };

   const handleExportCharacter = () => {
      if (!character) return;
      exportCharacterSheet(character);
      toast.success(tNotifications('Notifications.character.exported'));
   };

   const handleCharacterFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);

         if (importedData.fileType === 'FULL_CHARACTER_SHEET') {
            const newCharacter = migratedContent as Character;
            loadCharacter(newCharacter);
            toast.success(tNotifications('Notifications.character.imported'));
         } else {
            toast.error(tNotifications('Notifications.general.importFailed'));
         }
      } catch (error) {
         console.error("Failed to import character file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }

      characterFormRef.current?.reset();
   };

   const handleComponentFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);
         const { fileType } = importedData;

         const isCardType = fileType === 'CHARACTER_CARD' || fileType === 'CHARACTER_THEME' || fileType === 'GROUP_THEME';
         const isTrackerType = fileType === 'STATUS_TRACKER' || fileType === 'STORY_TAG_TRACKER';

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
         console.error("Failed to import component file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
      
      componentFormRef.current?.reset();
   };



   const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
   const handleResetCharacter = () => {
      resetCharacter();
      toast.success(tNotifications('Notifications.character.reset'));
   };

   const [isUnloadDialogOpen, setIsUnloadDialogOpen] = useState(false);
   const [unloadCountdown, setUnloadCountdown] = useState(UNLOAD_TIMER_SECONDS);

   useEffect(() => {
      if (!isUnloadDialogOpen) {
         return;
      }

      setUnloadCountdown(UNLOAD_TIMER_SECONDS);

      const timer = setInterval(() => {
         setUnloadCountdown((prevCountdown) => {
            if (prevCountdown <= 1) {
               clearInterval(timer);
               return 0;
            }
            return prevCountdown - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [isUnloadDialogOpen]);

   const handleUnloadCharacter = () => {
      unloadCharacter();
      toast.success(tNotifications('Notifications.character.unloaded'));
   };



   return (
      <aside 
         data-tour="sidebar-menu"
         className={cn(
            "hidden md:flex flex-col bg-card pt-4 border-r-2 border-border space-y-4 transition-all duration-300 ease-in-out overflow-hidden",
            isCollapsed ? "w-16 items-center" : "w-64"
         )}
      >
         <div className="flex flex-col justify-between w-full h-full">
            {/* Header */}
            <motion.section layout transition={{ duration: 0.2 }} className="w-full">
               <motion.div layout className={cn(
                  "flex w-full items-center",
                  isCollapsed ? "px-2 justify-center" : "px-4 justify-between",
                  activeWindow === 'MAIN_MENU' && "pb-4 border-b-2 border-border"
               )}>
                  {!isCollapsed && <h2 className="text-lg font-bold">{t('CharacterSheetPage.SidebarMenu.sidebarTitle')}</h2>}

                  <div data-tour="menu-collapse-button" onClick={onToggleCollapse} className="rounded p-2 hover:bg-muted cursor-pointer">
                     {isCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
                  </div>
               </motion.div>

               { activeWindow === 'PLAY_AREA' &&
                  <div className="pt-2 pb-4 border-b-2 border-border">
                     <CharacterUndoRedoControls isCollapsed={isCollapsed} />
                  </div>
               }
            </motion.section>

            {/* Context-specific scrollable buttons */}
            <div className="flex flex-col grow w-full min-h-0 overflow-y-auto overscroll-contain">
               { activeWindow === 'PLAY_AREA' && 
                  <>
                     <motion.section data-tour="menu-edit-drawer-buttons" layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 py-4 bg-popover border-b border-border",
                        isCollapsed ? "px-0" : "px-4"
                     )}>
                        <SidebarButton data-tour="edit-mode-toggle" isCollapsed={isCollapsed} onClick={onToggleEditing} Icon={isEditing ? Dices : Edit}>
                           {isEditing ? t('CharacterSheetPage.SidebarMenu.playMode') : t('CharacterSheetPage.SidebarMenu.editMode')}
                        </SidebarButton>
                        <SidebarButton data-tour="drawer-toggle" isCollapsed={isCollapsed} onClick={onToggleDrawer} Icon={BookUser}>
                           {isDrawerOpen ? t('CharacterSheetPage.SidebarMenu.closeDrawer') : t('CharacterSheetPage.SidebarMenu.openDrawer')}
                        </SidebarButton>
                     </motion.section>

                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 py-4 bg-popover border-b border-border",
                        isCollapsed ? "px-2" : "px-4"
                     )}>
                        <SidebarButton data-tour="save-character-button" isCollapsed={isCollapsed} onClick={handleSaveCharacterToDrawer} Icon={Save}>
                           {t('CharacterSheetPage.SidebarMenu.saveToDrawer')}
                        </SidebarButton>
                        <SidebarButton data-tour="save-character-as-button" isCollapsed={isCollapsed} onClick={handleSaveCharacterAsToDrawer} Icon={SaveAll}>
                           {t('CharacterSheetPage.SidebarMenu.saveToDrawerAs')}
                        </SidebarButton>
                        <SidebarButton data-tour="export-character-button" isCollapsed={isCollapsed} onClick={handleExportCharacter} Icon={Upload}>
                           {t('CharacterSheetPage.SidebarMenu.exportCharacter')}
                        </SidebarButton>
                        <SidebarButton data-tour="import-character-button" isCollapsed={isCollapsed} onClick={() => characterImportInputRef.current?.click()} Icon={Download}>
                           {t('CharacterSheetPage.SidebarMenu.importCharacter')}
                        </SidebarButton>
                        <SidebarButton data-tour="import-component-button" isCollapsed={isCollapsed} onClick={() => componentImportInputRef.current?.click()} Icon={Layers}>
                           {t('CharacterSheetPage.SidebarMenu.importComponent')}
                        </SidebarButton>
                     </motion.section>

                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 py-4 bg-popover border-b border-border",
                        isCollapsed ? "px-2" : "px-4"
                     )}>
                        <SidebarButton data-tour="reset-character-button" disabled={!character} variant="destructive" isCollapsed={isCollapsed} onClick={() => setIsResetDialogOpen(true)} Icon={Trash2}>
                           {t('CharacterSheetPage.SidebarMenu.resetCharacter')}
                        </SidebarButton>
                        <SidebarButton data-tour="unload-character-button" variant="destructive" isCollapsed={isCollapsed} onClick={() => setIsUnloadDialogOpen(true)} Icon={FileX}>
                           {t('CharacterSheetPage.SidebarMenu.unloadCharacter')}
                        </SidebarButton>
                     </motion.section>
                  </>
               }

               { activeWindow === 'MAIN_MENU' &&
                  <motion.section data-tour="menu-edit-drawer-buttons" layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 py-4 bg-popover border-b border-border",
                     isCollapsed ? "px-0" : "px-4"
                  )}>
                     <SidebarButton data-tour="import-character-button" isCollapsed={isCollapsed} onClick={() => characterImportInputRef.current?.click()} Icon={Download}>
                        {t('CharacterSheetPage.SidebarMenu.importCharacter')}
                     </SidebarButton>
                     <SidebarButton data-tour="drawer-toggle" isCollapsed={isCollapsed} onClick={onToggleDrawer} Icon={BookUser}>
                        {isDrawerOpen ? t('CharacterSheetPage.SidebarMenu.closeDrawer') : t('CharacterSheetPage.SidebarMenu.openDrawer')}
                     </SidebarButton>
                  </motion.section>
               }
            </div>

            {/* Bottom-aligned sub-menu buttons */}
            <div className="flex flex-col shrink-0 w-full">
               <motion.section layout transition={{ duration: 0.2 }} className={cn(
                  "flex flex-col items-center gap-2 py-4 bg-card border-t-2 border-border",
                  isCollapsed ? "px-2" : "px-4"
               )}>
                  <SidebarButton data-tour="settings-button" isCollapsed={isCollapsed} onClick={onOpenSettings} Icon={Settings}>
                     {t('CharacterSheetPage.SidebarMenu.settings')}
                  </SidebarButton>
                  <SidebarButton data-tour="app-info-button" isCollapsed={isCollapsed} onClick={onOpenInfo} Icon={Info}>
                     {t('CharacterSheetPage.SidebarMenu.info')}
                  </SidebarButton>
                  <SidebarButton data-tour="patch-notes-button" isCollapsed={isCollapsed} onClick={onOpenPatchNotes} Icon={Newspaper}>
                     {t('CharacterSheetPage.SidebarMenu.patchNotes')}
                  </SidebarButton>
               </motion.section>
            </div>


            <form ref={characterFormRef} className="hidden">
               <input
                  type="file"
                  ref={characterImportInputRef}
                  onChange={handleCharacterFileSelected}
                  accept=".cotm,application/json"
               />
            </form>
            <form ref={componentFormRef} className="hidden">
               <input
                  type="file"
                  ref={componentImportInputRef}
                  onChange={handleComponentFileSelected}
                  accept=".cotm,application/json"
               />
            </form>
         </div>



         <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('CharacterSheetPage.SidebarMenu.resetConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                     {t('CharacterSheetPage.SidebarMenu.resetConfirmDescription')}
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('CharacterSheetPage.SidebarMenu.resetConfirmCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" onClick={handleResetCharacter}>{t('CharacterSheetPage.SidebarMenu.resetConfirmButton')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         <AlertDialog open={isUnloadDialogOpen} onOpenChange={setIsUnloadDialogOpen}>
            <AlertDialogContent className="border-2 border-dashed border-destructive">
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('CharacterSheetPage.SidebarMenu.unloadConfirmTitle')}</AlertDialogTitle>

                  <AlertDialogDescription>{t('CharacterSheetPage.SidebarMenu.unloadConfirmDescription')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('CharacterSheetPage.SidebarMenu.unloadConfirmCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction 
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                     onClick={handleUnloadCharacter}
                     disabled={unloadCountdown > 0}
                  >
                     {unloadCountdown > 0 ? `${unloadCountdown}...` : t('CharacterSheetPage.SidebarMenu.unloadConfirmButton')}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </aside>
   );
}
