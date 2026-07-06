// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { Eye, Pencil } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Custom Hooks --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';

// -- Component Imports --
import { NoteDocument } from '@/components/molecules/NoteDocument';

// -- Store Imports --
import { useActiveNoteInstance } from '@/lib/notes/ActiveNoteStoreContext';

/*
 * The Note tab surface: a full-width document editor with an Edit <-> Preview toggle, PREVIEW as
 * the resting state (a newly opened Note shows the finished handout, not a text box - that default
 * is what sells "real document"). It reads the ACTIVE NOTE instance (never the character context)
 * and only mounts when a note tab is active.
 *
 * Preview = the {@link NoteDocument} renderer (document typography + a 68ch centered measure), with
 * mentions rendered free. Edit = a full-width textarea bound through `useInputDebouncer` (so the
 * buffer flushes on unmount), plus an explicit `flush` on unmount via `useCommitOnUnmount`: a tab
 * switch UNMOUNTS the surface with no blur, so without the flush the last keystroke is lost.
 */

export function NoteView() {
   const store = useActiveNoteInstance();
   if (!store) return null;
   return <NoteSurface key={store.getState().noteId ?? 'note'} />;
}

/** The editable surface, remounted per note id so its debounced buffers never cross documents. */
function NoteSurface() {
   const { t } = useTranslation();
   const store = useActiveNoteInstance()!;

   const note = useStore(store, (state) => state.note);
   const { updateTitle, updateBody, flush } = store.getState().actions;

   // Preview is the RESTING state: a Note opens looking like the finished document.
   const [isEditing, setIsEditing] = useState(false);

   // Buffer title + body locally; the hook flushes each on unmount. The explicit store flush
   // below is the belt to that suspenders - it forces an immediate row write on unmount.
   const [localTitle, setLocalTitle] = useInputDebouncer(note?.title ?? '', updateTitle);
   const [localBody, setLocalBody] = useInputDebouncer(note?.body ?? '', updateBody);

   // A tab switch unmounts this surface with no blur; force-persist the current document so the
   // last edit is never dropped to a cancelled debounce (the flagged data-loss trap).
   useCommitOnUnmount(flush);

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
            <button
               type="button"
               onClick={() => setIsEditing((editing) => !editing)}
               className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer"
               aria-pressed={isEditing}
            >
               {isEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
               {isEditing ? t('NoteView.preview') : t('NoteView.edit')}
            </button>
         </header>

         {/* Document body: the desk - the app-chrome backdrop the paper sheet floats and scrolls on. */}
         <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-8 md:px-8 md:py-12">
            {/* The paper sheet: the document lives ON it, dressed in the Paper palette - parchment by
                default, re-themed by a custom theme's --paper-* tokens, so custom themes reach Notes for
                free. Both modes share the sheet, so toggling edit/preview stays on the same page. */}
            <div className="mx-auto w-full max-w-[46rem] rounded-lg border border-paper-border bg-paper-background text-paper-foreground shadow-lg shadow-black/5">
               <div className="px-6 py-10 sm:px-10 md:px-16 md:py-16">
                  {isEditing ? (
                     <textarea
                        value={localBody}
                        onChange={(event) => setLocalBody(event.target.value)}
                        className={cn(
                           'min-h-[60vh] w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-paper-foreground',
                           'placeholder:text-paper-foreground/40 focus:outline-none',
                        )}
                        placeholder={t('NoteView.bodyPlaceholder')}
                        spellCheck
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
