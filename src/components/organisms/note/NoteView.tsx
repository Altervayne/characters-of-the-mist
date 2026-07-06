// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { Eye, ImagePlus, Loader2, Pencil } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Custom Hooks --
import { useInputDebouncer } from '@/hooks/useInputDebouncer';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';
import { useNoteImageInsertion } from '@/hooks/useNoteImageInsertion';

// -- Component Imports --
import { NoteDocument } from '@/components/molecules/NoteDocument';
import { NoteImageInspector } from '@/components/molecules/note/NoteImageInspector';

// -- Store Imports --
import { useActiveNoteInstance } from '@/lib/notes/ActiveNoteStoreContext';

// -- Local Imports --
import { activeImageTokenAt, parseImageHint, rewriteImageHintAt, setImageAlignAt } from '@/lib/notes/noteImageHint';

// -- Type Imports --
import type { NoteImageAlign } from '@/lib/notes/noteImageHint';

/*
 * The Note tab surface: a full-width document editor with an Edit <-> Preview toggle, PREVIEW as
 * the resting state (a newly opened Note shows the finished handout, not a text box - that default
 * is what sells "real document"). It reads the ACTIVE NOTE instance (never the character context)
 * and only mounts when a note tab is active.
 *
 * Preview = the {@link NoteDocument} renderer (document typography + a 68ch centered measure), with
 * mentions rendered free and inline `asset:` images resolved. Edit = a full-width textarea bound
 * through `useInputDebouncer` (so the buffer flushes on unmount), plus an explicit `flush` on unmount
 * via `useCommitOnUnmount`: a tab switch UNMOUNTS the surface with no blur, so without the flush the
 * last keystroke is lost. Inline images insert via the toolbar button, a clipboard paste, or a file
 * drop - all through one upload + caret-splice path.
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

   // Inline-image insertion (button / paste / drop). `getBody` reads a live ref, not the render
   // closure, so a splice landing after the async upload never overwrites intervening keystrokes.
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const columnRef = useRef<HTMLDivElement>(null);
   const bodyRef = useRef(localBody);
   useEffect(() => { bodyRef.current = localBody; }, [localBody]);
   const getBody = useCallback(() => bodyRef.current, []);
   // Caret-anchored image inspector: the active image is the token whose span holds the textarea caret.
   // Tracked on every caret move (select/click/key/input); an insert lands the caret in its new token.
   const [caret, setCaret] = useState<number | null>(null);
   const { fileInputRef, open: openImagePicker, isProcessing, handleFileSelected, handlePaste, handleDrop } =
      useNoteImageInsertion({ textareaRef, getBody, setBody: setLocalBody, onCaretMoved: setCaret });
   const syncCaret = useCallback(() => {
      const textarea = textareaRef.current;
      setCaret(textarea ? textarea.selectionStart : null);
   }, []);
   const activeToken = caret !== null ? activeImageTokenAt(localBody, caret) : null;

   // The column width for the resize drag→% math (read fresh on pointer-down).
   const getColumnWidth = useCallback(() => columnRef.current?.getBoundingClientRect().width ?? 0, []);

   /**
    * Applies a body transform to the ACTIVE image token and restores the caret INSIDE the (rewritten)
    * token, so the inspector stays open on it. The token's start offset is stable across a hint rewrite.
    */
   const applyToActiveToken = useCallback((transform: (body: string, index: number) => string) => {
      const current = caret;
      if (current === null) return;
      const token = activeImageTokenAt(bodyRef.current, current);
      if (!token) return;
      const nextBody = transform(bodyRef.current, token.index);
      setLocalBody(nextBody);
      // Keep the caret just inside the token so `activeImageTokenAt` still resolves it → inspector persists.
      const nextCaret = token.index + 1;
      setCaret(nextCaret);
      requestAnimationFrame(() => {
         const textarea = textareaRef.current;
         if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(nextCaret, nextCaret);
         }
      });
   }, [caret, setLocalBody]);

   const handleAlign = useCallback((align: NoteImageAlign, widthPct: number) => {
      applyToActiveToken((body, index) => setImageAlignAt(body, index, align, widthPct));
   }, [applyToActiveToken]);

   const handleWidth = useCallback((widthPct: number) => {
      applyToActiveToken((body, index) => {
         const token = activeImageTokenAt(body, index)!;
         const { align } = parseImageHint(token.title);
         return rewriteImageHintAt(body, index, { align, widthPct });
      });
   }, [applyToActiveToken]);

   const handleCaption = useCallback((alt: string) => {
      applyToActiveToken((body, index) => {
         const token = activeImageTokenAt(body, index)!;
         return rewriteImageHintAt(body, index, parseImageHint(token.title), alt);
      });
   }, [applyToActiveToken]);

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
            {/* Insert-image button: edit mode only. Uploads via the shared pipeline and splices the
                asset markdown at the caret. */}
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
            <button
               type="button"
               onClick={() => setIsEditing((editing) => !editing)}
               className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer"
               aria-pressed={isEditing}
            >
               {isEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
               {isEditing ? t('NoteView.preview') : t('NoteView.edit')}
            </button>
            {/* Hidden picker for the insert-image button; the paste/drop paths never touch it. */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
         </header>

         {/* Document body: the desk - the app-chrome backdrop the paper sheet floats and scrolls on. */}
         <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-8 md:px-8 md:py-12">
            {/* The paper sheet: the document lives ON it, dressed in the Paper palette - parchment by
                default, re-themed by a custom theme's --paper-* tokens, so custom themes reach Notes for
                free. Both modes share the sheet, so toggling edit/preview stays on the same page. */}
            <div className="mx-auto w-full max-w-[46rem] rounded-lg border border-paper-border bg-paper-background text-paper-foreground shadow-lg shadow-black/5">
               <div ref={columnRef} className="px-6 py-10 sm:px-10 md:px-16 md:py-16">
                  {isEditing ? (
                     <>
                        {/* Caret-anchored image inspector: appears while the caret sits in an image token. */}
                        {activeToken && (
                           <NoteImageInspector
                              token={activeToken}
                              getColumnWidth={getColumnWidth}
                              onAlign={handleAlign}
                              onWidth={handleWidth}
                              onCaption={handleCaption}
                           />
                        )}
                        <textarea
                           ref={textareaRef}
                           value={localBody}
                           onChange={(event) => { setLocalBody(event.target.value); syncCaret(); }}
                           onSelect={syncCaret}
                           onKeyUp={syncCaret}
                           onClick={syncCaret}
                           onFocus={syncCaret}
                           onPaste={handlePaste}
                           onDrop={handleDrop}
                           className={cn(
                              'min-h-[60vh] w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-paper-foreground',
                              'placeholder:text-paper-foreground/40 focus:outline-none',
                           )}
                           placeholder={t('NoteView.bodyPlaceholder')}
                           spellCheck
                        />
                     </>
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
