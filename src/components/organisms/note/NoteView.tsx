// -- React Imports --
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { BookOpen, Code, ImagePlus, Loader2, PenLine } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Custom Hooks --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';
import { useNoteImageInsertion } from '@/hooks/useNoteImageInsertion';

// -- Component Imports --
import { NoteDocument } from '@/components/molecules/NoteDocument';
import { NoteEditor } from '@/components/organisms/note/NoteEditor';

// -- Store Imports --
import { useActiveNoteInstance } from '@/lib/notes/ActiveNoteStoreContext';

// -- Type Imports --
import type { NoteEditorHandle } from '@/components/organisms/note/NoteEditor';

/*
 * The Note tab surface: the document editor on the paper sheet. It reads the ACTIVE NOTE instance (never the
 * character context) and only mounts when a note tab is active.
 *
 * Three modes, one CM6 surface for the two editable ones:
 *  - READING = the finished handout via {@link NoteDocument} (react-markdown), non-editable, CM6 unmounted.
 *  - LIVE    = the home mode: the CM6 editor renders the document inline (syntax hidden off-cursor, mention
 *    pills, inline resizable/alignable image widgets) while you type in the same surface.
 *  - SOURCE  = the CM6 editor with raw markdown + syntax highlighting, decorations off (the escape hatch).
 *
 * Data-loss guard: a tab switch UNMOUNTS with no blur, so the store `flush` runs on unmount AND the CM6
 * editor flushes its final buffer on destroy - the last keystroke is never lost. Image align/resize/caption
 * are done ON the inline image widget in Live (the docked inspector is retired).
 */

type NoteMode = 'reading' | 'live' | 'source';

export function NoteView() {
   const store = useActiveNoteInstance();
   if (!store) return null;
   return <NoteSurface key={store.getState().noteId ?? 'note'} />;
}

/** The editable surface, remounted per note id so its buffers never cross documents. */
function NoteSurface() {
   const { t } = useTranslation();
   const store = useActiveNoteInstance()!;

   const note = useStore(store, (state) => state.note);
   const { updateTitle, updateBody, flush } = store.getState().actions;

   // A note opens in LIVE - the home mode where you both see AND touch the document (Overseer-locked).
   const [mode, setMode] = useState<NoteMode>('live');
   const isEditing = mode === 'live' || mode === 'source';

   // Buffer title + body locally; the debouncer flushes each on unmount. The store `flush` is the belt.
   const [localTitle, setLocalTitle] = useInputDebouncer(note?.title ?? '', updateTitle);
   const [localBody, setLocalBody] = useInputDebouncer(note?.body ?? '', updateBody);
   useCommitOnUnmount(flush);

   // The CM6 editor handle (splice at real offsets), for image insertion.
   const editorRef = useRef<NoteEditorHandle>(null);

   /** Splices a snippet into the CM6 doc at the caret, landing the caret INSIDE the new token (after `![`). */
   const spliceAdapter = useMemo(() => ({
      spliceAtCaret: (snippet: string) => {
         const editor = editorRef.current;
         if (!editor) return;
         const from = editor.getCaret();
         editor.splice(from, from, snippet, from + 2);
      },
   }), []);
   const { fileInputRef, open: openImagePicker, isProcessing, handleFileSelected, handleImageEvent } =
      useNoteImageInsertion({ adapter: spliceAdapter });

   if (!note) return null;

   return (
      <main className="absolute inset-0 flex flex-col overflow-hidden bg-background">
         {/* Title + mode toggle header. */}
         <header className="flex items-center gap-3 border-b border-border bg-popover px-4 py-3">
            <input
               type="text"
               value={localTitle}
               onChange={(event) => setLocalTitle(event.target.value)}
               className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-popover-foreground focus:outline-none"
               placeholder={t('NoteView.titlePlaceholder')}
            />
            {/* Insert-image button: editable modes only. Uploads via the shared pipeline and splices into CM6. */}
            {isEditing && (
               <button
                  type="button"
                  onClick={openImagePicker}
                  disabled={isProcessing}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer disabled:cursor-default disabled:opacity-60"
                  title={t('NoteView.insertImage')}
               >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {t('NoteView.insertImage')}
               </button>
            )}
            <ModeToggle mode={mode} onChange={setMode} />
            {/* Hidden picker for the insert-image button; the paste/drop paths never touch it. */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
         </header>

         {/* Document body: the desk - the app-chrome backdrop the paper sheet floats and scrolls on. */}
         <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-8 md:px-8 md:py-12">
            {/* The paper sheet: parchment by default, re-themed by a custom theme's --paper-* tokens. Both
                modes share the sheet, so toggling reading/editing stays on the same page. */}
            <div className="mx-auto w-full max-w-[46rem] rounded-lg border border-paper-border bg-paper-background text-paper-foreground shadow-lg shadow-black/5">
               <div className="px-6 py-10 sm:px-10 md:px-16 md:py-16">
                  {isEditing ? (
                     <NoteEditor
                        ref={editorRef}
                        value={localBody}
                        onChange={setLocalBody}
                        onImageEvent={handleImageEvent}
                        live={mode === 'live'}
                        placeholder={t('NoteView.bodyPlaceholder')}
                     />
                  ) : note.body.trim() ? (
                     <NoteDocument body={note.body} />
                  ) : (
                     <p className="text-base text-paper-foreground/50">
                        {t('NoteView.emptyPreview')}
                     </p>
                  )}
               </div>
            </div>
         </div>
      </main>
   );
}

/*
 * The mode toggle: a 3-segment control (theme-token chrome) in the note header - Reading / Live / Source,
 * Obsidian's order and idiom. One is always active; icons BookOpen / PenLine / Code.
 */
function ModeToggle({ mode, onChange }: { mode: NoteMode; onChange: (mode: NoteMode) => void }) {
   const { t } = useTranslation();
   const segment = (active: boolean) =>
      cn(
         'flex items-center gap-1.5 rounded px-2.5 py-1 text-sm cursor-pointer',
         active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
      );
   return (
      <div className="inline-flex shrink-0 items-center rounded-md border border-border p-0.5">
         <button type="button" onClick={() => onChange('reading')} aria-pressed={mode === 'reading'} className={segment(mode === 'reading')}>
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{t('NoteView.mode.reading')}</span>
         </button>
         <button type="button" onClick={() => onChange('live')} aria-pressed={mode === 'live'} className={segment(mode === 'live')}>
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">{t('NoteView.mode.live')}</span>
         </button>
         <button type="button" onClick={() => onChange('source')} aria-pressed={mode === 'source'} className={segment(mode === 'source')}>
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline">{t('NoteView.mode.source')}</span>
         </button>
      </div>
   );
}
