// -- React Imports --
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Pipeline / Asset Store --
import { processImage } from '@/lib/assets/processImage';
import { storeAsset } from '@/lib/assets/assetRepository';

/*
 * Inline-image insertion for the Note editor. Every path - the toolbar button, a clipboard paste, a
 * dropped file - funnels through the SAME upload (process -> store -> hash) and the SAME cursor splice,
 * so a note's image markdown is produced in exactly one place. The splice reads the textarea's live
 * `selectionStart/End` and rewrites the body buffer with `![](asset:<hash>)` at the caret, restoring the
 * caret just past the inserted markdown so typing continues naturally.
 *
 * The caller owns the body buffer (the debounced `[localBody, setLocalBody]`); this hook only needs a ref
 * to the textarea and the getter/setter. It handles its own hidden file input for the button path.
 */

interface NoteImageInsertionArgs {
   /** Ref to the editor textarea, for reading the live caret and restoring it after a splice. */
   textareaRef: React.RefObject<HTMLTextAreaElement | null>;
   /** The current body buffer value (the debounced local buffer). */
   getBody: () => string;
   /** Writes the new body buffer (the debounced local setter). */
   setBody: (body: string) => void;
   /** Notifies the surface where the caret landed after an insert, so its image inspector opens on the new image. */
   onCaretMoved?: (caret: number) => void;
}

/** Builds the markdown for an inserted asset image. Alt is left empty; the inspector adds a caption. */
function imageMarkdown(hash: string): string {
   return `![](asset:${hash})`;
}

export function useNoteImageInsertion({ textareaRef, getBody, setBody, onCaretMoved }: NoteImageInsertionArgs) {
   const { t } = useTranslation();
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   /** Splices `snippet` at the textarea's caret (or appends when it isn't focused), restoring the caret after. */
   const spliceAtCaret = useCallback((snippet: string) => {
      const textarea = textareaRef.current;
      const body = getBody();
      // No live caret (e.g. inserted before focusing): append on its own block.
      if (!textarea) {
         const needsBreak = body.length > 0 && !body.endsWith('\n');
         setBody(`${body}${needsBreak ? '\n\n' : ''}${snippet}`);
         return;
      }
      const start = textarea.selectionStart ?? body.length;
      const end = textarea.selectionEnd ?? body.length;
      const next = `${body.slice(0, start)}${snippet}${body.slice(end)}`;
      setBody(next);
      // Restore the caret just INSIDE the inserted token (after `![`), so the image inspector opens on
      // the fresh image at once - insert→adjust is one motion. `+2` sits within the token's span.
      const caret = start + 2;
      onCaretMoved?.(caret);
      requestAnimationFrame(() => {
         textarea.focus();
         textarea.setSelectionRange(caret, caret);
      });
   }, [textareaRef, getBody, setBody, onCaretMoved]);

   /** Processes a source blob through the asset pipeline and splices its image markdown at the caret. */
   const insertFromBlob = useCallback(async (blob: Blob) => {
      setIsProcessing(true);
      try {
         const processed = await processImage(blob);
         const hash = await storeAsset(processed);
         spliceAtCaret(imageMarkdown(hash));
      } catch {
         toast.error(t('NoteView.imageInsertFailed'));
      } finally {
         setIsProcessing(false);
      }
   }, [spliceAtCaret, t]);

   /** Button path: opens the hidden file picker. */
   const open = useCallback(() => fileInputRef.current?.click(), []);

   /** Button path: the picker's change handler. */
   const handleFileSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void insertFromBlob(file);
   }, [insertFromBlob]);

   /** Paste path: inserts the first image on the clipboard, if any. Non-image pastes fall through to default. */
   const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const imageItem = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();
      if (!file) return; // let a normal text paste happen
      event.preventDefault();
      void insertFromBlob(file);
   }, [insertFromBlob]);

   /** Drop path: inserts the first dropped image file. */
   const handleDrop = useCallback((event: React.DragEvent<HTMLTextAreaElement>) => {
      const file = [...event.dataTransfer.files].find((f) => f.type.startsWith('image/'));
      if (!file) return; // not an image drop; leave default handling
      event.preventDefault();
      void insertFromBlob(file);
   }, [insertFromBlob]);

   return { fileInputRef, open, isProcessing, handleFileSelected, handlePaste, handleDrop };
}
