// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// -- Icon Imports --
import { Edit, Dices, BookUser, Save, Download, Upload, Layers, Trash2, PanelLeftOpen, PanelLeftClose, Settings, Info, Newspaper, SaveAll, SquareMenu } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { exportCharacterSheet, exportToFile, generateExportFilename, importFromFile } from '@/lib/utils/export-import';
import { harmonizeData } from '@/lib/harmonization';
import { getDrawerItemDisplayPath } from '@/lib/drawer/drawerItemPath';
import { saveCharacterToLinkedDrawerItem } from '@/lib/character/characterRepository';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { importBoard, loadBoard } from '@/lib/board/boardRepository';
import { reIdBoardAggregate } from '@/lib/board/reIdBoardAggregate';

// -- Component Imports --
import { CharacterUndoRedoControls } from '../molecules/CharacterUndoRedoControls';
import { BoardUndoRedoControls } from '../molecules/BoardUndoRedoControls';
import { SidebarButton } from '../molecules/SidebarButton';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { useDrawerActions, useDrawerStore } from '@/lib/stores/drawerStore';

// -- Other Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';
import type { Board } from '@/lib/types/board';



type WindowTypes = 'MAIN_MENU' | 'PLAY_AREA' | 'BOARD';

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

export function SidebarMenu({ isEditing, isDrawerOpen, isCollapsed, activeWindow, onToggleEditing, onToggleDrawer, onToggleCollapse, onOpenSettings, onOpenInfo, onOpenPatchNotes }: SidebarMenuProps) {
   const { t } = useTranslation();
   const { t: tNotifications } = useTranslation();

   const character = useCharacterStore((state) => state.character);
   const drawerCurrentFolderId = useDrawerStore((state) => state.currentFolderId);
   // `loadCharacter` here is the Save-As relink (sets drawerItemId on the CURRENT
   // active character), not a tab open, it stays a per-character action. Opening a
   // *different* character (file import) and returning to the menu go through the
   // TabManager.
   const { loadCharacter, addImportedCard, addImportedTracker, resetCharacter, setHasUnsavedChanges } = useCharacterActions();
   const { openCharacterTab, openBoardTab, deactivate } = useTabManagerActions();
   const { initiateItemDrop, reloadCurrentFolder } = useDrawerActions();

   const characterImportInputRef = useRef<HTMLInputElement>(null);
   const characterFormRef = useRef<HTMLFormElement>(null);
   const componentImportInputRef = useRef<HTMLInputElement>(null);
   const componentFormRef = useRef<HTMLFormElement>(null);
   const boardImportInputRef = useRef<HTMLInputElement>(null);
   const boardFormRef = useRef<HTMLFormElement>(null);



   const handleSaveCharacterToDrawer = async () => {
      if (!character) return;

      if (character.drawerItemId) {
         const savedItemId = character.drawerItemId;
         try {
            // Atomic cross-store save: working record + the linked drawer item in one
            // transaction.
            const { linkedItemUpdated } = await saveCharacterToLinkedDrawerItem(character);
            if (linkedItemUpdated) {
               // The working record now matches its drawer copy.
               setHasUnsavedChanges(false);
               await reloadCurrentFolder();
               const itemPath = await getDrawerItemDisplayPath(savedItemId);
               toast.success(`${tNotifications('Notifications.character.saved')} ${itemPath}`);
            } else {
               // The linked drawer item was deleted: fall back to Save As + notify.
               handleSaveCharacterAsToDrawer();
               toast(tNotifications('Notifications.character.linkedItemMissing'));
            }
         } catch {
            toast.error(tNotifications('Notifications.drawer.actionFailed'));
         }
      } else {
         handleSaveCharacterAsToDrawer();
      }
   };

   const handleSaveCharacterAsToDrawer = () => {
      if (!character) return;

      const newItemId = cuid();
      const characterWithDrawerId = { ...character, drawerItemId: newItemId };

      loadCharacter(character, newItemId);
      // loadCharacter sets the flag clean, but the change subscription fires on the new
      // character reference and re-dirties it; assert clean once more after.
      setHasUnsavedChanges(false);

      if (!isDrawerOpen) {
         onToggleDrawer();
      }

      initiateItemDrop({
         game: character.game,
         type: 'FULL_CHARACTER_SHEET',
         content: characterWithDrawerId,
         defaultName: character.name,
         presetId: newItemId,
         parentFolderId: drawerCurrentFolderId ?? undefined,
      });
   };

   const handleSaveBoardToDrawer = async () => {
      const store = getActiveBoardStore();
      if (!store) return;
      const { boardId, drawerItemId } = store.getState();
      if (!boardId) return;

      if (drawerItemId) {
         try {
            // Atomic cross-store save of the linked drawer copy, mirroring the character.
            const result = await store.getState().actions.saveToDrawer();
            if (result?.linkedItemUpdated) {
               await reloadCurrentFolder();
               const itemPath = await getDrawerItemDisplayPath(drawerItemId);
               toast.success(`${tNotifications('Notifications.board.saved')} ${itemPath}`);
            } else {
               // The linked drawer item was deleted: fall back to Save As + notify.
               await handleSaveBoardAsToDrawer();
               toast(tNotifications('Notifications.board.linkedItemMissing'));
            }
         } catch {
            toast.error(tNotifications('Notifications.drawer.actionFailed'));
         }
      } else {
         await handleSaveBoardAsToDrawer();
      }
   };

   const handleSaveBoardAsToDrawer = async () => {
      const store = getActiveBoardStore();
      if (!store) return;
      const { boardId, name } = store.getState();
      if (!boardId) return;

      // Link the working board to a new drawer item id (also flushes the live viewport
      // and marks the board clean); the returned aggregate seeds the drawer item content.
      const newItemId = cuid();
      const aggregate = await store.getState().actions.linkToDrawerItem(newItemId);
      if (!aggregate) return;

      if (!isDrawerOpen) {
         onToggleDrawer();
      }

      // A board is game-agnostic -> a NEUTRAL drawer item; the naming window finalizes it.
      initiateItemDrop({
         game: 'NEUTRAL',
         type: 'FULL_BOARD',
         content: aggregate,
         defaultName: name,
         presetId: newItemId,
         parentFolderId: drawerCurrentFolderId ?? undefined,
      });
   };

   const handleExportCharacter = async () => {
      if (!character) return;
      try {
         await exportCharacterSheet(character);
         toast.success(tNotifications('Notifications.character.exported'));
      } catch {
         toast.error(tNotifications('Notifications.general.exportError'));
      }
   };

   const handleCharacterFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);

         if (importedData.fileType === 'FULL_CHARACTER_SHEET') {
            const newCharacter = migratedContent as Character;
            openCharacterTab(newCharacter);
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

   const handleExportBoard = async () => {
      const store = getActiveBoardStore();
      if (!store) return;
      const { boardId } = store.getState();
      if (!boardId) return;
      try {
         // Serialize from the repo (items persist optimistically); the generic export
         // embeds any board image / card-copy art via collectFromBoard.
         const aggregate = await loadBoard(boardId);
         if (!aggregate) return;
         await exportToFile(aggregate, 'FULL_BOARD', 'NEUTRAL', generateExportFilename('NEUTRAL', 'FULL_BOARD', aggregate.name));
         toast.success(tNotifications('Notifications.board.exported'));
      } catch {
         toast.error(tNotifications('Notifications.general.exportError'));
      }
   };

   const handleBoardFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         if (importedData.fileType === 'FULL_BOARD') {
            const migratedContent = harmonizeData(importedData.content, importedData.fileType) as Board;
            // Fresh, independent identity (connection-safe) so re-importing the same file
            // never collides with an existing board id.
            const reIded = reIdBoardAggregate(migratedContent);
            await importBoard(reIded);
            await openBoardTab(reIded.id);
            toast.success(tNotifications('Notifications.board.imported'));
         } else {
            toast.error(tNotifications('Notifications.general.importFailed'));
         }
      } catch (error) {
         console.error("Failed to import board file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }

      boardFormRef.current?.reset();
   };

   const handleComponentFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);
         const { fileType } = importedData;

         const isCardType = fileType === 'CHARACTER_CARD' || fileType === 'CHARACTER_THEME' || fileType === 'GROUP_THEME' || fileType === 'IMAGE_CARD';
         const isTrackerType = fileType === 'STATUS_TRACKER' || fileType === 'STORY_TAG_TRACKER';

         if (isCardType) {
            const added = addImportedCard(migratedContent as CardData);
            if (added) {
               toast.success(tNotifications('Notifications.character.componentImported'));
            } else {
               toast.error(tNotifications('Notifications.character.duplicatePortrait'));
            }
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

   const handleOpenMenu = () => {
      // Show the main menu but keep every open tab and its live instance; this is a
      // view switch, not a close.
      deactivate();
   };



   return (
      <aside 
         data-tour="sidebar-menu"
         className={cn(
            "hidden md:flex flex-col bg-card pt-2 border-r-2 border-border space-y-4 transition-all duration-300 ease-in-out overflow-hidden",
            isCollapsed ? "w-14 items-center" : "w-60"
         )}
      >
         <div className="flex flex-col justify-between w-full h-full">
            {/* Header */}
            <motion.section layout transition={{ duration: 0.2 }} className="w-full">
               <motion.div layout className={cn(
                  "flex w-full items-center px-2",
                  isCollapsed ? "justify-center" : "justify-between",
                  activeWindow === 'MAIN_MENU' && "pb-2 border-b-2 border-border"
               )}>
                  {!isCollapsed && <h2 className="text-lg font-bold">{t('CharacterSheetPage.SidebarMenu.sidebarTitle')}</h2>}

                  <div data-tour="menu-collapse-button" onClick={onToggleCollapse} className="rounded p-2 hover:bg-muted cursor-pointer">
                     {isCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
                  </div>
               </motion.div>

               { activeWindow === 'PLAY_AREA' &&
                  <div className="py-2 border-b-2 border-border">
                     <CharacterUndoRedoControls isCollapsed={isCollapsed} />
                  </div>
               }

               { activeWindow === 'BOARD' &&
                  <div className="py-2 border-b-2 border-border">
                     <BoardUndoRedoControls isCollapsed={isCollapsed} />
                  </div>
               }
            </motion.section>

            {/* Context-specific scrollable buttons */}
            <div className="flex flex-col grow w-full min-h-0 overflow-y-auto overscroll-contain">
               { activeWindow === 'PLAY_AREA' && 
                  <>
                     <motion.section data-tour="menu-edit-drawer-buttons" layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 py-2 bg-popover border-b border-border",
                        isCollapsed ? "px-0" : "px-2"
                     )}>
                        <SidebarButton data-tour="edit-mode-toggle" isCollapsed={isCollapsed} onClick={onToggleEditing} Icon={isEditing ? Dices : Edit}>
                           {isEditing ? t('CharacterSheetPage.SidebarMenu.playMode') : t('CharacterSheetPage.SidebarMenu.editMode')}
                        </SidebarButton>
                        <SidebarButton data-tour="drawer-toggle" isCollapsed={isCollapsed} onClick={onToggleDrawer} Icon={BookUser}>
                           {isDrawerOpen ? t('CharacterSheetPage.SidebarMenu.closeDrawer') : t('CharacterSheetPage.SidebarMenu.openDrawer')}
                        </SidebarButton>
                     </motion.section>

                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
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
                        "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                     )}>
                        <SidebarButton data-tour="reset-character-button" disabled={!character} variant="destructive" isCollapsed={isCollapsed} onClick={() => setIsResetDialogOpen(true)} Icon={Trash2}>
                           {t('CharacterSheetPage.SidebarMenu.resetCharacter')}
                        </SidebarButton>
                     </motion.section>
                  </>
               }

               { activeWindow === 'BOARD' &&
                  <motion.section layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                  )}>
                     <SidebarButton isCollapsed={isCollapsed} onClick={handleSaveBoardToDrawer} Icon={Save}>
                        {t('CharacterSheetPage.SidebarMenu.saveBoardToDrawer')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={handleSaveBoardAsToDrawer} Icon={SaveAll}>
                        {t('CharacterSheetPage.SidebarMenu.saveBoardToDrawerAs')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={handleExportBoard} Icon={Upload}>
                        {t('CharacterSheetPage.SidebarMenu.exportBoard')}
                     </SidebarButton>
                  </motion.section>
               }

               { activeWindow === 'MAIN_MENU' &&
                  <motion.section data-tour="menu-edit-drawer-buttons" layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 py-2 bg-popover border-b border-border",
                     isCollapsed ? "px-0" : "px-2"
                  )}>
                     <SidebarButton data-tour="import-character-button" isCollapsed={isCollapsed} onClick={() => characterImportInputRef.current?.click()} Icon={Download}>
                        {t('CharacterSheetPage.SidebarMenu.importCharacter')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={() => boardImportInputRef.current?.click()} Icon={Download}>
                        {t('CharacterSheetPage.SidebarMenu.importBoard')}
                     </SidebarButton>
                     <SidebarButton data-tour="drawer-toggle" isCollapsed={isCollapsed} onClick={onToggleDrawer} Icon={BookUser}>
                        {isDrawerOpen ? t('CharacterSheetPage.SidebarMenu.closeDrawer') : t('CharacterSheetPage.SidebarMenu.openDrawer')}
                     </SidebarButton>
                  </motion.section>
               }
            </div>

            {/* Bottom-aligned sub-menu buttons */}
            <div className="flex flex-col shrink-0 w-full">
               {/* "Open menu" is a navigation action (leave the sheet/board, go home), set
                   apart from the meta utilities below by a divider. It has nowhere to go
                   from the main menu itself, so it shows in the play area and on a board. */}
               { (activeWindow === 'PLAY_AREA' || activeWindow === 'BOARD') &&
                  <motion.section layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 p-2 bg-card border-t-2 border-b border-border"
                  )}>
                     <SidebarButton data-tour="open-menu-button" isCollapsed={isCollapsed} onClick={handleOpenMenu} Icon={SquareMenu}>
                        {t('CharacterSheetPage.SidebarMenu.openMenu')}
                     </SidebarButton>
                  </motion.section>
               }
               {/* The trio anchors the bottom region with the top border when the Open-menu
                   section above is hidden. */}
               <motion.section layout transition={{ duration: 0.2 }} className={cn(
                  "flex flex-col items-center gap-2 p-2 bg-card",
                  activeWindow === 'MAIN_MENU' && "border-t-2 border-border"
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
            <form ref={boardFormRef} className="hidden">
               <input
                  type="file"
                  ref={boardImportInputRef}
                  onChange={handleBoardFileSelected}
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
      </aside>
   );
}
