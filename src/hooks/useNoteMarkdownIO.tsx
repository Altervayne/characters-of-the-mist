// -- React Imports --
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// -- Utils Imports --
import { downloadTextFile, readFileAsText } from '@/lib/utils/export-import';
import { noteToMarkdown } from '@/lib/notes/noteMarkdown';
import { markdownFilename, noteFromMarkdown, noteHasImages } from '@/lib/notes/noteMarkdownFile';

// -- Store and Hook Imports --
import { getActiveNoteStore } from '@/lib/notes/noteStoreRegistry';
import { importNote, loadNote } from '@/lib/notes/noteRepository';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/**
 * The plain-`.md` export/import flow for the active note, shared by the sidebar and the command
 * palette so both drive one implementation (and one warning dialog + one picker). Export serializes
 * the note through {@link noteToMarkdown}; when the note has images - which are refs, not bytes, so
 * they can't travel in a `.md` - it warns first. Import reads the text, builds a fresh note, and
 * opens it as a tab. `dialogs` must be rendered once by the host.
 */
export function useNoteMarkdownIO() {
   const { t } = useTranslation();
   const { openNoteTab } = useTabManagerActions();

   const inputRef = useRef<HTMLInputElement>(null);
   const formRef = useRef<HTMLFormElement>(null);

   // A note staged for export while the "images won't travel" warning is up; null when nothing pends.
   const [pendingExport, setPendingExport] = useState<Note | null>(null);

   const writeMarkdown = (note: Note) => {
      downloadTextFile(markdownFilename(note.title), noteToMarkdown(note));
      toast.success(t('Notifications.note.exportedMarkdown'));
   };

   const exportActiveNoteAsMarkdown = async () => {
      const store = getActiveNoteStore();
      if (!store) return;
      const { noteId } = store.getState();
      if (!noteId) return;
      try {
         const note = await loadNote(noteId);
         if (!note) return;
         // Images ride along as local refs, so warn before the file leaves the device; otherwise silent.
         if (noteHasImages(note)) setPendingExport(note);
         else writeMarkdown(note);
      } catch {
         toast.error(t('Notifications.general.exportError'));
      }
   };

   const confirmExport = () => {
      if (pendingExport) writeMarkdown(pendingExport);
      setPendingExport(null);
   };

   const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
         const text = await readFileAsText(file);
         // Materialize the parsed markdown as a new working note (unlinked, so a first save routes to
         // Save-As), then open its tab by id.
         const note = noteFromMarkdown(text, file.name);
         await importNote(note, null);
         await openNoteTab(note.id);
         toast.success(t('Notifications.note.importedMarkdown'));
      } catch (error) {
         console.error('Failed to import markdown file:', error);
         toast.error(t('Notifications.general.importFailed'));
      }
      formRef.current?.reset();
   };

   const triggerMarkdownImport = () => inputRef.current?.click();

   const dialogs = (
      <>
         <form ref={formRef} className="hidden">
            <input
               type="file"
               ref={inputRef}
               onChange={handleFileSelected}
               accept=".md,.markdown,text/markdown,text/plain"
            />
         </form>

         <AlertDialog open={pendingExport !== null} onOpenChange={(open) => { if (!open) setPendingExport(null); }}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('CharacterSheetPage.SidebarMenu.exportMarkdownWarningTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('CharacterSheetPage.SidebarMenu.exportMarkdownWarningDescription')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('CharacterSheetPage.SidebarMenu.exportMarkdownWarningCancel')}</AlertDialogCancel>
                  <AlertDialogAction className="cursor-pointer" onClick={confirmExport}>{t('CharacterSheetPage.SidebarMenu.exportMarkdownWarningConfirm')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </>
   );

   return { exportActiveNoteAsMarkdown, triggerMarkdownImport, dialogs };
}
