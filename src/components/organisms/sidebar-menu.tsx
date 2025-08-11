'use client';

// -- React Imports --
import React, { useRef, useState } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// -- Icon Imports --
import { Edit, Dices, BookUser, Save, Download, Upload, Layers, Trash2, PanelLeftOpen, PanelLeftClose, Settings, Info, Newspaper } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { exportCharacterSheet, importFromFile } from '@/lib/utils/export-import';

// -- Component Imports --
import { CharacterUndoRedoControls } from '../molecules/character-undo-redo-controls';
import { SidebarButton } from '../molecules/sidebar-button';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Type Imports --
import { Character, Card as CardData, Tracker } from '@/lib/types/character';



interface SidebarMenuProps {
   isEditing: boolean;
   isDrawerOpen: boolean;
   isCollapsed: boolean;
   onToggleEditing: () => void;
   onToggleDrawer: () => void;
   onToggleCollapse: () => void;
   onOpenSettings: () => void;
   onOpenInfo: () => void;
   onOpenPatchNotes: () => void;
}



export function SidebarMenu({ isEditing, isDrawerOpen, isCollapsed, onToggleEditing, onToggleDrawer, onToggleCollapse, onOpenSettings, onOpenInfo, onOpenPatchNotes }: SidebarMenuProps) {
   const t = useTranslations('CharacterSheetPage.SidebarMenu');
   const tNotifications = useTranslations('Notifications')

   const character = useCharacterStore((state) => state.character);
   const { loadCharacter, addImportedCard, addImportedTracker, resetCharacter } = useCharacterActions();
   const { addItem } = useDrawerActions();

   const characterImportInputRef = useRef<HTMLInputElement>(null);
   const characterFormRef = useRef<HTMLFormElement>(null);
   const componentImportInputRef = useRef<HTMLInputElement>(null);
   const componentFormRef = useRef<HTMLFormElement>(null);



   const handleSaveCharacterToDrawer = () => {
      if (!character) return;

      addItem(
         character.name,
         character.game,
         'FULL_CHARACTER_SHEET',
         character,
         undefined
      );

      toast.success(tNotifications('character.savedToDrawer'));
   };

   const handleExportCharacter = () => {
      if (!character) return;
      exportCharacterSheet(character);
      toast.success(tNotifications('character.exported'));
   };

   const handleCharacterFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);

         if (importedData.fileType === 'FULL_CHARACTER_SHEET') {
            const newCharacter = importedData.content as Character;
            loadCharacter(newCharacter);
            toast.success(tNotifications('character.imported'));
         } else {
            toast.error(tNotifications('general.importFailed'));
         }
      } catch (error) {
         console.error("Failed to import character file:", error);
         toast.error(tNotifications('general.importFailed'));
      }

      characterFormRef.current?.reset();
   };

   const handleComponentFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const { fileType, content } = importedData;

         const isCardType = fileType === 'CHARACTER_CARD' || fileType === 'CHARACTER_THEME' || fileType === 'GROUP_THEME';
         const isTrackerType = fileType === 'STATUS_TRACKER' || fileType === 'STORY_TAG_TRACKER';

         if (isCardType) {
            addImportedCard(content as CardData);
            toast.success(tNotifications('character.componentImported'));
         } else if (isTrackerType) {
            addImportedTracker(content as Tracker);
            toast.success(tNotifications('character.componentImported'));
         } else {
            toast.error(tNotifications('general.importFailed'));
         }
      } catch (error) {
         console.error("Failed to import component file:", error);
         toast.error(tNotifications('general.importFailed'));
      }
      
      componentFormRef.current?.reset();
   };



   const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

   const handleResetCharacter = () => {
      resetCharacter();
      toast.success(tNotifications('character.reset'));
   };



   return (
      <aside 
         data-tour="sidebar-menu"
         className={cn(
            "hidden md:flex flex-col bg-card py-4 border-r-2 border-border space-y-4 transition-all duration-300 ease-in-out overflow-hidden",
            isCollapsed ? "w-16 items-center" : "w-64"
         )}
      >
         <div className="w-full">
            <motion.section layout transition={{ duration: 0.2 }} className="w-full">
               <motion.div layout className={cn(
                  "flex w-full items-center",
                  isCollapsed ? "px-2 justify-center" : "px-4 justify-between"
               )}>
                  {!isCollapsed && <h2 className="text-lg font-bold">{t('sidebarTitle')}</h2>}

                  <div data-tour="menu-collapse-button" onClick={onToggleCollapse} className="rounded p-2 hover:bg-muted cursor-pointer">
                     {isCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
                  </div>
               </motion.div>

               <div className="pt-2 pb-4 border-b-2 border-border">
                  <CharacterUndoRedoControls isCollapsed={isCollapsed} />
               </div>
            </motion.section>

            <motion.section data-tour="menu-edit-drawer-buttons" layout transition={{ duration: 0.2 }} className={cn(
               "flex flex-col items-center gap-2 py-4 border-b-1 border-border",
               isCollapsed ? "px-0" : "px-4"
            )}>
               <SidebarButton data-tour="edit-mode-toggle" isCollapsed={isCollapsed} onClick={onToggleEditing} Icon={isEditing ? Dices : Edit}>
                  {isEditing ? t('playMode') : t('editMode')}
               </SidebarButton>
               <SidebarButton data-tour="drawer-toggle" isCollapsed={isCollapsed} onClick={onToggleDrawer} Icon={BookUser}>
                  {isDrawerOpen ? t('closeDrawer') : t('openDrawer')}
               </SidebarButton>
            </motion.section>

            <motion.section layout transition={{ duration: 0.2 }} className={cn(
               "flex flex-col items-center gap-2 py-4 border-b-1 border-border",
               isCollapsed ? "px-2" : "px-4"
            )}>
               <SidebarButton data-tour="save-character-button" isCollapsed={isCollapsed} onClick={handleSaveCharacterToDrawer} Icon={Save}>
                  {t('saveToDrawer')}
               </SidebarButton>
               <SidebarButton data-tour="export-character-button" isCollapsed={isCollapsed} onClick={handleExportCharacter} Icon={Upload}>
                  {t('exportCharacter')}
               </SidebarButton>
               <SidebarButton data-tour="import-character-button" isCollapsed={isCollapsed} onClick={() => characterImportInputRef.current?.click()} Icon={Download}>
                  {t('importCharacter')}
               </SidebarButton>
               <SidebarButton data-tour="import-component-button" isCollapsed={isCollapsed} onClick={() => componentImportInputRef.current?.click()} Icon={Layers}>
                  {t('importComponent')}
               </SidebarButton>
               <SidebarButton data-tour="reset-character-button" disabled={!character} variant="destructive" isCollapsed={isCollapsed} onClick={() => setIsResetDialogOpen(true)} Icon={Trash2}>
                  {t('resetCharacter')}
               </SidebarButton>
            </motion.section>

            <motion.section layout transition={{ duration: 0.2 }} className={cn(
               "flex flex-col items-center gap-2 py-4 border-b-1 border-border",
               isCollapsed ? "px-2" : "px-4"
            )}>
               <SidebarButton data-tour="settings-button" isCollapsed={isCollapsed} onClick={onOpenSettings} Icon={Settings}>
                  {t('settings')}
               </SidebarButton>
               <SidebarButton data-tour="app-info-button" isCollapsed={isCollapsed} onClick={onOpenInfo} Icon={Info}>
                  {t('info')}
               </SidebarButton>
               <SidebarButton data-tour="patch-notes-button" isCollapsed={isCollapsed} onClick={onOpenPatchNotes} Icon={Newspaper}>
                  {t('patchNotes')}
               </SidebarButton>
            </motion.section>

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
                  <AlertDialogTitle>{t('resetConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                     {t('resetConfirmDescription')}
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('resetConfirmCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" onClick={handleResetCharacter}>{t('resetConfirmButton')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </aside>
   );
}
