// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// -- Icon Imports --
import { Edit, Dices, BookUser, Waypoints, Save, Download, Upload, Layers, Trash2, PanelLeftOpen, PanelLeftClose, Settings, LifeBuoy, Sparkles, SaveAll, SquareMenu, RefreshCw, FileUp } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { exportCharacterSheet, exportToFile, generateExportFilename, importFromFile, readFileAsText } from '@/lib/utils/export-import';
import { noteFromMarkdown } from '@/lib/notes/noteMarkdownFile';
import { harmonizeData } from '@/lib/harmonization';
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { importBoard, loadBoard } from '@/lib/board/boardRepository';
import { collectBoardEmbeddedEntities } from '@/lib/board/collectBoardEmbeddedEntities';
import { prepareImportedBoard } from '@/lib/board/importBoardReferencedCharacters';
import { getActiveNoteStore } from '@/lib/notes/noteStoreRegistry';
import { importNote, loadNote } from '@/lib/notes/noteRepository';
import { reIdNote } from '@/lib/notes/reIdNote';
import { reIdCharacterAggregate } from '@/lib/character/reIdCharacterAggregate';

// -- Component Imports --
import { CharacterUndoRedoControls } from '../molecules/CharacterUndoRedoControls';
import { BoardUndoRedoControls } from '../molecules/BoardUndoRedoControls';
import { NoteUndoRedoControls } from '../molecules/NoteUndoRedoControls';
import { SidebarButton } from '../molecules/SidebarButton';
import { ClearBoardControl } from '../molecules/ClearBoardControl';

// -- Store and Hook Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useSaveToDrawer } from '@/hooks/useSaveToDrawer';
import { useHasUnreadPatchNotes } from '@/hooks/useHasUnreadPatchNotes';

// -- Type Imports --
import type { Character, Card as CardData, Tracker } from '@/lib/types/character';
import type { Board, Note } from '@/lib/types/board';



type WindowTypes = 'MAIN_MENU' | 'PLAY_AREA' | 'BOARD' | 'NOTE';

interface SidebarMenuProps {
   isEditing: boolean;
   isDrawerOpen: boolean;
   isCollapsed: boolean;
   activeWindow: WindowTypes;
   onExportNoteMarkdown: () => void;
   onImportNoteMarkdownFile: (file: File) => Promise<void>;
   onToggleEditing: () => void;
   onToggleDrawer: () => void;
   onToggleCollapse: () => void;
   onOpenSettings: () => void;
   onOpenWhatsNew: () => void;
   onOpenHelp: () => void;
}

export function SidebarMenu({ isEditing, isDrawerOpen, isCollapsed, activeWindow, onExportNoteMarkdown, onImportNoteMarkdownFile, onToggleEditing, onToggleDrawer, onToggleCollapse, onOpenSettings, onOpenWhatsNew, onOpenHelp }: SidebarMenuProps) {
   const { t } = useTranslation();
   const { t: tNotifications } = useTranslation();

   const character = useCharacterStore((state) => state.character);
   // `loadCharacter` here replaces the CURRENT active character in place (update-from-file keeps its
   // drawerItemId), not a tab open, so it stays a per-character action. Opening a *different* character
   // (file import) and returning to the menu go through the TabManager.
   const { loadCharacter, addImportedCard, addImportedTracker, resetCharacter, setHasUnsavedChanges } = useCharacterActions();
   const { openCharacterTab, openBoardTab, openNoteTab, deactivate } = useTabManagerActions();
   const { reloadCurrentFolder } = useDrawerActions();

   // The app-wide dice tray toggles a bottom panel (reachable from any window).
   const isDiceTrayOpen = useAppSettingsStore((state) => state.diceTray.isOpen);
   const { toggleDiceTray } = useAppSettingsActions();

   // The Navigator toggles a left slide-over that crawls the portal graph (reachable from any window).
   const navigatorOpen = useAppSettingsStore((state) => state.navigatorOpen);
   const { toggleNavigator } = useAppSettingsActions();

   // The New! dot rides the What's-new door until the user opens that section.
   const hasUnreadPatchNotes = useHasUnreadPatchNotes();

   const characterImportInputRef = useRef<HTMLInputElement>(null);
   const characterFormRef = useRef<HTMLFormElement>(null);
   const componentImportInputRef = useRef<HTMLInputElement>(null);
   const componentFormRef = useRef<HTMLFormElement>(null);
   const boardImportInputRef = useRef<HTMLInputElement>(null);
   const boardFormRef = useRef<HTMLFormElement>(null);
   const characterUpdateInputRef = useRef<HTMLInputElement>(null);
   const characterUpdateFormRef = useRef<HTMLFormElement>(null);
   const boardUpdateInputRef = useRef<HTMLInputElement>(null);
   const boardUpdateFormRef = useRef<HTMLFormElement>(null);
   const noteImportInputRef = useRef<HTMLInputElement>(null);
   const noteFormRef = useRef<HTMLFormElement>(null);
   const noteUpdateInputRef = useRef<HTMLInputElement>(null);
   const noteUpdateFormRef = useRef<HTMLFormElement>(null);
   const workspaceImportInputRef = useRef<HTMLInputElement>(null);
   const workspaceFormRef = useRef<HTMLFormElement>(null);



   // Save-to-drawer (Save + Save-As, character + board + note) lives in a shared hook so the sidebar and
   // the command palette drive one implementation.
   const { saveCharacterToDrawer, saveCharacterAsToDrawer, saveBoardToDrawer, saveBoardAsToDrawer, saveNoteToDrawer, saveNoteAsToDrawer } = useSaveToDrawer();

   const handleExportCharacter = async () => {
      if (!character) return;
      try {
         await exportCharacterSheet(character);
         toast.success(tNotifications('Notifications.character.exported'));
      } catch {
         toast.error(tNotifications('Notifications.general.exportError'));
      }
   };

   // One import for any workspace file: sniff the fileType (a plain .md becomes a note) and route it to the
   // matching path. Folds the separate character / board / note imports into a single "from file" entry.
   const handleWorkspaceFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // A plain markdown file imports as a portable-text note (which owns its own toasts).
      const name = file.name.toLowerCase();
      if (name.endsWith('.md') || name.endsWith('.markdown')) {
         await onImportNoteMarkdownFile(file);
         workspaceFormRef.current?.reset();
         return;
      }

      try {
         const importedData = await importFromFile(file);
         switch (importedData.fileType) {
            case 'FULL_CHARACTER_SHEET': {
               // An import is a fresh entity: re-id so it can't collide with an open tab or overwrite an
               // existing working row (that is the "update from file" path). The aggregate re-id keeps the
               // card/journal order and journal bookmarks intact.
               const newCharacter = reIdCharacterAggregate(harmonizeData(importedData.content, importedData.fileType) as Character);
               openCharacterTab(newCharacter);
               toast.success(tNotifications('Notifications.character.imported'));
               break;
            }
            case 'FULL_BOARD': {
               const migratedContent = harmonizeData(importedData.content, importedData.fileType) as Board;
               const prepared = await prepareImportedBoard(
                  migratedContent,
                  importedData.embedded,
                  t('Drawer.importedFromBoardFolder', { board: migratedContent.name }),
               );
               await importBoard(prepared);
               await reloadCurrentFolder();
               await openBoardTab(prepared.id);
               toast.success(tNotifications('Notifications.board.imported'));
               break;
            }
            case 'NOTE': {
               // A fresh import re-ids, so it can't collide with an open note tab or overwrite an existing row.
               const note = reIdNote(importedData.content as Note);
               await importNote(note, null);
               await openNoteTab(note.id);
               toast.success(tNotifications('Notifications.note.imported'));
               break;
            }
            default:
               toast.error(tNotifications('Notifications.general.importFailed'));
         }
      } catch (error) {
         console.error('Failed to import workspace file:', error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }

      workspaceFormRef.current?.reset();
   };

   const handleCharacterFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
         const importedData = await importFromFile(file);
         const migratedContent = harmonizeData(importedData.content, importedData.fileType);

         if (importedData.fileType === 'FULL_CHARACTER_SHEET') {
            // A fresh import re-ids (order + journal bookmarks preserved); "update from file" is the replace path.
            const newCharacter = reIdCharacterAggregate(migratedContent as Character);
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
         // Embed the full data of every character AND note the board's tiles reference, so those live
         // references survive on another machine (their portraits / covers / inline images ride the assets map).
         const embedded = await collectBoardEmbeddedEntities(aggregate);
         await exportToFile(aggregate, 'FULL_BOARD', 'NEUTRAL', generateExportFilename('NEUTRAL', 'FULL_BOARD', aggregate.name), embedded);
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
            // Rehydrate the board's referenced characters (link existing / recreate absent, ids kept),
            // re-id for a fresh independent copy, then rewire the elements to the local characters.
            const prepared = await prepareImportedBoard(
               migratedContent,
               importedData.embedded,
               t('Drawer.importedFromBoardFolder', { board: migratedContent.name }),
            );
            await importBoard(prepared);
            // The import may have written an "Imported from {board}" folder straight to the DB;
            // re-read the current view so it shows without an app reload (a no-op on a pure link).
            await reloadCurrentFolder();
            await openBoardTab(prepared.id);
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

   const handleExportNote = async () => {
      const store = getActiveNoteStore();
      if (!store) return;
      const { noteId } = store.getState();
      if (!noteId) return;
      try {
         // Serialize from the repo (the note store debounce-saves onto its row). A note is a flat
         // document with no asset references yet, so the generic export needs no embed.
         const aggregate = await loadNote(noteId);
         if (!aggregate) return;
         await exportToFile(aggregate, 'NOTE', 'NEUTRAL', generateExportFilename('NEUTRAL', 'NOTE', aggregate.title));
         toast.success(tNotifications('Notifications.note.exported'));
      } catch {
         toast.error(tNotifications('Notifications.general.exportError'));
      }
   };

   const handleNoteFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Route by extension: a plain markdown file imports as portable text, everything else as the
      // full-fidelity `.cotm` envelope. The markdown branch owns its own toasts.
      const name = file.name.toLowerCase();
      if (name.endsWith('.md') || name.endsWith('.markdown')) {
         await onImportNoteMarkdownFile(file);
         noteFormRef.current?.reset();
         return;
      }

      try {
         const importedData = await importFromFile(file);
         if (importedData.fileType === 'NOTE') {
            // A note is 2.0-native (no harmonize step); re-id it (a fresh import is a fresh entity, never a
            // replace-by-id), materialize it into the working table (unlinked, so a first save routes to
            // Save-As), then open its tab by id.
            const note = reIdNote(importedData.content as Note);
            await importNote(note, null);
            await openNoteTab(note.id);
            toast.success(tNotifications('Notifications.note.imported'));
         } else {
            toast.error(tNotifications('Notifications.general.importFailed'));
         }
      } catch (error) {
         console.error("Failed to import note file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }

      noteFormRef.current?.reset();
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



   // Update-in-place: overwrite the OPEN character/board with a file's contents while KEEPING its id +
   // drawer link, so every reference-by-id (a board's character element, the drawer copy) stays intact.
   // A pick validates the type then stashes the parsed entity; the confirm dialog is the last gate
   // before the destructive replace. No re-ID here (that's the new-board path) - the id is preserved.
   const [pendingCharacterUpdate, setPendingCharacterUpdate] = useState<Character | null>(null);
   const [pendingBoardUpdate, setPendingBoardUpdate] = useState<Board | null>(null);
   // A note update stashes the incoming content plus whether it replaces the cover: a `.cotm` update
   // replaces everything (cover included); a `.md` update carries no cover, so it keeps the existing one.
   const [pendingNoteUpdate, setPendingNoteUpdate] = useState<{ note: Note; replaceCover: boolean } | null>(null);

   const handleCharacterUpdateFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
         const importedData = await importFromFile(file);
         if (importedData.fileType !== 'FULL_CHARACTER_SHEET' || !character) {
            toast.error(tNotifications('Notifications.general.importFailed'));
         } else {
            setPendingCharacterUpdate(harmonizeData(importedData.content, importedData.fileType) as Character);
         }
      } catch (error) {
         console.error("Failed to read character file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
      characterUpdateFormRef.current?.reset();
   };

   const handleBoardUpdateFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
         const importedData = await importFromFile(file);
         const hasActiveBoard = !!getActiveBoardStore()?.getState().boardId;
         if (importedData.fileType !== 'FULL_BOARD' || !hasActiveBoard) {
            toast.error(tNotifications('Notifications.general.importFailed'));
         } else {
            setPendingBoardUpdate(harmonizeData(importedData.content, importedData.fileType) as Board);
         }
      } catch (error) {
         console.error("Failed to read board file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
      boardUpdateFormRef.current?.reset();
   };

   const handleNoteUpdateFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const hasActiveNote = !!getActiveNoteStore()?.getState().note;
      try {
         const name = file.name.toLowerCase();
         if (name.endsWith('.md') || name.endsWith('.markdown')) {
            // Markdown replaces title + body only; the existing cover is kept.
            if (!hasActiveNote) {
               toast.error(tNotifications('Notifications.general.importFailed'));
            } else {
               const note = noteFromMarkdown(await readFileAsText(file), file.name);
               setPendingNoteUpdate({ note, replaceCover: false });
            }
         } else {
            // A `.cotm` note replaces everything, cover included. Notes are 2.0-native (no harmonize).
            const importedData = await importFromFile(file);
            if (importedData.fileType !== 'NOTE' || !hasActiveNote) {
               toast.error(tNotifications('Notifications.general.importFailed'));
            } else {
               setPendingNoteUpdate({ note: importedData.content as Note, replaceCover: true });
            }
         }
      } catch (error) {
         console.error("Failed to read note file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
      noteUpdateFormRef.current?.reset();
   };

   const confirmCharacterUpdate = () => {
      if (!pendingCharacterUpdate || !character) { setPendingCharacterUpdate(null); return; }
      // Keep this character's identity + drawer link; take everything else from the file. The same id
      // means loadCharacter replaces the active tab's instance in place (no duplicate tab).
      const updated: Character = { ...pendingCharacterUpdate, id: character.id, drawerItemId: character.drawerItemId };
      loadCharacter(updated, character.drawerItemId);
      // Overwritten in the working store but not yet pushed to the drawer copy - mark dirty until Save.
      setHasUnsavedChanges(true);
      setPendingCharacterUpdate(null);
      toast.success(tNotifications('Notifications.character.updated'));
   };

   const confirmBoardUpdate = async () => {
      const store = getActiveBoardStore();
      const boardId = store?.getState().boardId;
      if (!pendingBoardUpdate || !store || !boardId) { setPendingBoardUpdate(null); return; }
      // Keep this board's id + drawer link; replace its rows wholesale from the file (the file's item
      // ids are a consistent set). hydrate reloads clean, so mark dirty after.
      const updated: Board = { ...pendingBoardUpdate, id: boardId, drawerItemId: store.getState().drawerItemId ?? undefined };
      try {
         await importBoard(updated);
         await store.getState().actions.hydrate(boardId);
         store.getState().actions.setHasUnsavedChanges(true);
         toast.success(tNotifications('Notifications.board.updated'));
      } catch (error) {
         console.error("Failed to update board from file:", error);
         toast.error(tNotifications('Notifications.general.importFailed'));
      }
      setPendingBoardUpdate(null);
   };

   const confirmNoteUpdate = () => {
      const store = getActiveNoteStore();
      const current = store?.getState().note;
      if (!pendingNoteUpdate || !store || !current) { setPendingNoteUpdate(null); return; }
      // Keep this note's id + drawer link; take title/body from the file. A `.cotm` replaces the cover
      // too; a `.md` keeps the current one. loadNote re-seeds the open editor in place; mark dirty until Save.
      const { note, replaceCover } = pendingNoteUpdate;
      const updated: Note = { id: current.id, title: note.title, body: note.body, cover: replaceCover ? note.cover : current.cover };
      const { loadNote: loadNoteIntoStore, setHasUnsavedChanges: setNoteDirty, flush } = store.getState().actions;
      loadNoteIntoStore(updated, store.getState().drawerItemId);
      setNoteDirty(true);
      flush();
      setPendingNoteUpdate(null);
      toast.success(tNotifications('Notifications.note.updated'));
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
         data-tutorial="sidebar-menu"
         className={cn(
            "hidden md:flex flex-col bg-card pt-2 border-r-2 border-border space-y-4 ease-in-out overflow-hidden",
            isCollapsed ? "w-14 items-center" : "w-60"
         )}
         style={{
            // The rail opens immediately but waits to CLOSE until the buttons have collapsed to one line
            // (the height-collapse, 200ms) - otherwise it would clip the still-wide buttons mid-collapse.
            transitionProperty: 'width',
            transitionDuration: '300ms',
            transitionTimingFunction: 'ease-in-out',
            transitionDelay: isCollapsed ? '200ms' : '0ms',
         }}
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

                  <div data-tutorial="menu-collapse-button" onClick={onToggleCollapse} className="rounded p-2 hover:bg-muted cursor-pointer">
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

               { activeWindow === 'NOTE' &&
                  <div className="py-2 border-b-2 border-border">
                     <NoteUndoRedoControls isCollapsed={isCollapsed} />
                  </div>
               }
            </motion.section>

            {/* Context-specific scrollable buttons */}
            <div className="flex flex-col grow w-full min-h-0 overflow-y-auto overscroll-contain">
               {/* Submenus: the panel toggles (Drawer + Dice Tray + Navigator) lead every context, side by side
                   and identical wherever you are. Each goes muted while its panel is open. */}
               <motion.section layout transition={{ duration: 0.2 }} className={cn(
                  "flex flex-col items-center gap-2 py-2 bg-popover border-b border-border",
                  isCollapsed ? "px-0" : "px-2"
               )}>
                  <SidebarButton data-tutorial="drawer-toggle" isCollapsed={isCollapsed} onClick={onToggleDrawer} variant={isDrawerOpen ? 'secondary' : 'default'} Icon={BookUser}>
                     {t('CharacterSheetPage.SidebarMenu.drawer')}
                  </SidebarButton>
                  <SidebarButton data-tutorial="dice-tray-button" isCollapsed={isCollapsed} onClick={toggleDiceTray} variant={isDiceTrayOpen ? 'secondary' : 'default'} Icon={Dices}>
                     {t('CharacterSheetPage.SidebarMenu.diceTray')}
                  </SidebarButton>
                  <SidebarButton data-tutorial="navigator-button" isCollapsed={isCollapsed} onClick={toggleNavigator} variant={navigatorOpen ? 'secondary' : 'default'} Icon={Waypoints}>
                     {t('CharacterSheetPage.SidebarMenu.navigator')}
                  </SidebarButton>
               </motion.section>

               { activeWindow === 'PLAY_AREA' &&
                  <>
                     <motion.section data-tutorial="menu-edit-drawer-buttons" layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 py-2 bg-popover border-b border-border",
                        isCollapsed ? "px-0" : "px-2"
                     )}>
                        <SidebarButton data-tutorial="edit-mode-toggle" isCollapsed={isCollapsed} onClick={onToggleEditing} variant={isEditing ? 'secondary' : 'default'} Icon={Edit}>
                           {t('CharacterSheetPage.SidebarMenu.editMode')}
                        </SidebarButton>
                     </motion.section>

                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                     )}>
                        <SidebarButton data-tutorial="save-character-button" isCollapsed={isCollapsed} onClick={saveCharacterToDrawer} Icon={Save}>
                           {t('CharacterSheetPage.SidebarMenu.saveToDrawer')}
                        </SidebarButton>
                        <SidebarButton data-tutorial="save-character-as-button" isCollapsed={isCollapsed} onClick={saveCharacterAsToDrawer} Icon={SaveAll}>
                           {t('CharacterSheetPage.SidebarMenu.saveToDrawerAs')}
                        </SidebarButton>
                        <SidebarButton data-tutorial="export-character-button" isCollapsed={isCollapsed} onClick={handleExportCharacter} Icon={Upload}>
                           {t('CharacterSheetPage.SidebarMenu.exportCharacter')}
                        </SidebarButton>
                        <SidebarButton data-tutorial="import-character-button" isCollapsed={isCollapsed} onClick={() => characterImportInputRef.current?.click()} Icon={Download}>
                           {t('CharacterSheetPage.SidebarMenu.importCharacter')}
                        </SidebarButton>
                        <SidebarButton isCollapsed={isCollapsed} onClick={() => characterUpdateInputRef.current?.click()} Icon={RefreshCw}>
                           {t('CharacterSheetPage.SidebarMenu.updateCharacter')}
                        </SidebarButton>
                        <SidebarButton data-tutorial="import-component-button" isCollapsed={isCollapsed} onClick={() => componentImportInputRef.current?.click()} Icon={Layers}>
                           {t('CharacterSheetPage.SidebarMenu.importComponent')}
                        </SidebarButton>
                     </motion.section>

                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                     )}>
                        <SidebarButton data-tutorial="reset-character-button" disabled={!character} variant="destructive" isCollapsed={isCollapsed} onClick={() => setIsResetDialogOpen(true)} Icon={Trash2}>
                           {t('CharacterSheetPage.SidebarMenu.resetCharacter')}
                        </SidebarButton>
                     </motion.section>
                  </>
               }

               { activeWindow === 'BOARD' &&
                  <>
                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                     )}>
                        <SidebarButton isCollapsed={isCollapsed} onClick={saveBoardToDrawer} Icon={Save}>
                           {t('CharacterSheetPage.SidebarMenu.saveBoardToDrawer')}
                        </SidebarButton>
                        <SidebarButton isCollapsed={isCollapsed} onClick={saveBoardAsToDrawer} Icon={SaveAll}>
                           {t('CharacterSheetPage.SidebarMenu.saveBoardToDrawerAs')}
                        </SidebarButton>
                        <SidebarButton isCollapsed={isCollapsed} onClick={handleExportBoard} Icon={Upload}>
                           {t('CharacterSheetPage.SidebarMenu.exportBoard')}
                        </SidebarButton>
                        <SidebarButton isCollapsed={isCollapsed} onClick={() => boardImportInputRef.current?.click()} Icon={Download}>
                           {t('CharacterSheetPage.SidebarMenu.importBoard')}
                        </SidebarButton>
                        <SidebarButton isCollapsed={isCollapsed} onClick={() => boardUpdateInputRef.current?.click()} Icon={RefreshCw}>
                           {t('CharacterSheetPage.SidebarMenu.updateBoard')}
                        </SidebarButton>
                     </motion.section>

                     <motion.section layout transition={{ duration: 0.2 }} className={cn(
                        "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                     )}>
                        <ClearBoardControl isCollapsed={isCollapsed} />
                     </motion.section>
                  </>
               }

               { activeWindow === 'NOTE' &&
                  <motion.section layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 p-2 bg-popover border-b border-border"
                  )}>
                     <SidebarButton isCollapsed={isCollapsed} onClick={saveNoteToDrawer} Icon={Save}>
                        {t('CharacterSheetPage.SidebarMenu.saveNoteToDrawer')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={saveNoteAsToDrawer} Icon={SaveAll}>
                        {t('CharacterSheetPage.SidebarMenu.saveNoteToDrawerAs')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={handleExportNote} Icon={Upload}>
                        {t('CharacterSheetPage.SidebarMenu.exportNote')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={() => noteImportInputRef.current?.click()} Icon={Download}>
                        {t('CharacterSheetPage.SidebarMenu.importNote')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={onExportNoteMarkdown} Icon={FileUp}>
                        {t('CharacterSheetPage.SidebarMenu.exportNoteMarkdown')}
                     </SidebarButton>
                     <SidebarButton isCollapsed={isCollapsed} onClick={() => noteUpdateInputRef.current?.click()} Icon={RefreshCw}>
                        {t('CharacterSheetPage.SidebarMenu.updateNote')}
                     </SidebarButton>
                  </motion.section>
               }

               { activeWindow === 'MAIN_MENU' &&
                  <motion.section layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 py-2 bg-popover border-b border-border",
                     isCollapsed ? "px-0" : "px-2"
                  )}>
                     <SidebarButton isCollapsed={isCollapsed} onClick={() => workspaceImportInputRef.current?.click()} Icon={FileUp}>
                        {t('CharacterSheetPage.SidebarMenu.importWorkspace')}
                     </SidebarButton>
                  </motion.section>
               }
            </div>

            {/* Bottom-aligned sub-menu buttons */}
            <div className="flex flex-col shrink-0 w-full">
               {/* "Open menu" is a navigation action (leave the sheet/board, go home), set
                   apart from the meta utilities below by a divider. It has nowhere to go
                   from the main menu itself, so it shows in the play area and on a board. */}
               { (activeWindow === 'PLAY_AREA' || activeWindow === 'BOARD' || activeWindow === 'NOTE') &&
                  <motion.section layout transition={{ duration: 0.2 }} className={cn(
                     "flex flex-col items-center gap-2 p-2 bg-card border-t-2 border-b border-border"
                  )}>
                     <SidebarButton data-tutorial="open-menu-button" isCollapsed={isCollapsed} onClick={handleOpenMenu} Icon={SquareMenu}>
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
                  <SidebarButton data-tutorial="settings-button" isCollapsed={isCollapsed} onClick={onOpenSettings} Icon={Settings}>
                     {t('CharacterSheetPage.SidebarMenu.settings')}
                  </SidebarButton>
                  {/* What's new carries the New! dot in its corner until the section is opened. */}
                  <div className="relative">
                     <SidebarButton data-tutorial="whats-new-button" isCollapsed={isCollapsed} onClick={onOpenWhatsNew} Icon={Sparkles}>
                        {t('CharacterSheetPage.SidebarMenu.whatsNew')}
                     </SidebarButton>
                     {hasUnreadPatchNotes && (
                        <span className="pointer-events-none absolute right-2 top-2 size-2 rounded-full bg-primary" aria-hidden />
                     )}
                  </div>
                  <SidebarButton data-tutorial="help-button" isCollapsed={isCollapsed} onClick={onOpenHelp} Icon={LifeBuoy}>
                     {t('CharacterSheetPage.SidebarMenu.help')}
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
            <form ref={characterUpdateFormRef} className="hidden">
               <input
                  type="file"
                  ref={characterUpdateInputRef}
                  onChange={handleCharacterUpdateFileSelected}
                  accept=".cotm,application/json"
               />
            </form>
            <form ref={boardUpdateFormRef} className="hidden">
               <input
                  type="file"
                  ref={boardUpdateInputRef}
                  onChange={handleBoardUpdateFileSelected}
                  accept=".cotm,application/json"
               />
            </form>
            <form ref={noteFormRef} className="hidden">
               <input
                  type="file"
                  ref={noteImportInputRef}
                  onChange={handleNoteFileSelected}
                  accept=".cotm,application/json,.md,.markdown,text/markdown"
               />
            </form>
            <form ref={noteUpdateFormRef} className="hidden">
               <input
                  type="file"
                  ref={noteUpdateInputRef}
                  onChange={handleNoteUpdateFileSelected}
                  accept=".cotm,application/json,.md,.markdown,text/markdown"
               />
            </form>
            <form ref={workspaceFormRef} className="hidden">
               <input
                  type="file"
                  ref={workspaceImportInputRef}
                  onChange={handleWorkspaceFileSelected}
                  accept=".cotm,application/json,.md,.markdown,text/markdown"
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

         <AlertDialog open={pendingCharacterUpdate !== null} onOpenChange={(open) => { if (!open) setPendingCharacterUpdate(null); }}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('CharacterSheetPage.SidebarMenu.updateCharacterConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('CharacterSheetPage.SidebarMenu.updateCharacterConfirmDescription')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('CharacterSheetPage.SidebarMenu.updateConfirmCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" onClick={confirmCharacterUpdate}>{t('CharacterSheetPage.SidebarMenu.updateConfirmButton')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         <AlertDialog open={pendingBoardUpdate !== null} onOpenChange={(open) => { if (!open) setPendingBoardUpdate(null); }}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('CharacterSheetPage.SidebarMenu.updateBoardConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('CharacterSheetPage.SidebarMenu.updateBoardConfirmDescription')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('CharacterSheetPage.SidebarMenu.updateConfirmCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" onClick={confirmBoardUpdate}>{t('CharacterSheetPage.SidebarMenu.updateConfirmButton')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         <AlertDialog open={pendingNoteUpdate !== null} onOpenChange={(open) => { if (!open) setPendingNoteUpdate(null); }}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('CharacterSheetPage.SidebarMenu.updateNoteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('CharacterSheetPage.SidebarMenu.updateNoteConfirmDescription')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('CharacterSheetPage.SidebarMenu.updateConfirmCancelButton')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" onClick={confirmNoteUpdate}>{t('CharacterSheetPage.SidebarMenu.updateConfirmButton')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </aside>
   );
}
