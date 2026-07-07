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
 * dropped file - funnels through the SAME upload (process -> store -> hash) and the SAME splice, so a
 * note's image markdown is produced in exactly one place. The upload pipeline is editor-agnostic; the
 * splice is delegated to an injected {@link SpliceAdapter}, so the same hook drives a textarea today and
 * the CM6 editor now (the adapter re-points the caret read / write, nothing else changes).
 */

/**
 * The editor-specific splice seam. The upload pipeline stays identical across editors; only WHERE the
 * `![](asset:hash)` snippet lands differs (a textarea's `selectionStart`, or a CM6 `view.dispatch`).
 */
export interface SpliceAdapter {
   /** Inserts `snippet` at the current caret, landing the caret INSIDE the new token so its controls open at once. */
   spliceAtCaret: (snippet: string) => void;
}

interface NoteImageInsertionArgs {
   /** The editor's splice seam (textarea or CM6). */
   adapter: SpliceAdapter;
}

/** Builds the markdown for an inserted asset image. Alt is left empty; layout/caption are edited after. */
function imageMarkdown(hash: string): string {
   return `![](asset:${hash})`;
}

export function useNoteImageInsertion({ adapter }: NoteImageInsertionArgs) {
   const { t } = useTranslation();
   const [isProcessing, setIsProcessing] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);
   // Latest-ref so the async insert always splices through the CURRENT adapter (a re-render swaps it).
   const adapterRef = useRef(adapter);
   adapterRef.current = adapter;

   /** Processes a source blob through the asset pipeline and splices its image markdown at the caret. */
   const insertFromBlob = useCallback(async (blob: Blob) => {
      setIsProcessing(true);
      try {
         const processed = await processImage(blob);
         const hash = await storeAsset(processed);
         adapterRef.current.spliceAtCaret(imageMarkdown(hash));
      } catch {
         toast.error(t('NoteView.imageInsertFailed'));
      } finally {
         setIsProcessing(false);
      }
   }, [t]);

   /** Button path: opens the hidden file picker. */
   const open = useCallback(() => fileInputRef.current?.click(), []);

   /** Button path: the picker's change handler. */
   const handleFileSelected = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void insertFromBlob(file);
   }, [insertFromBlob]);

   /** Extracts the first image file off a clipboard/drag data source, or null. Shared by paste + drop. */
   const imageFileFrom = useCallback((items: DataTransferItemList | undefined, files: FileList | undefined): File | null => {
      const fromItems = items ? [...items].find((item) => item.type.startsWith('image/'))?.getAsFile() ?? null : null;
      if (fromItems) return fromItems;
      return files ? [...files].find((f) => f.type.startsWith('image/')) ?? null : null;
   }, []);

   /**
    * Paste/drop handler for a native (CM6) DOM event: inserts the first image on the clipboard/drop, or
    * returns `false` to let the editor handle a normal (non-image) paste/drop. Returning `true` means handled.
    */
   const handleImageEvent = useCallback((event: ClipboardEvent | DragEvent): boolean => {
      const data = event instanceof ClipboardEvent ? event.clipboardData : event.dataTransfer;
      const file = imageFileFrom(data?.items, data?.files);
      if (!file) return false; // not an image: let the editor do its normal paste/drop
      event.preventDefault();
      void insertFromBlob(file);
      return true;
   }, [imageFileFrom, insertFromBlob]);

   return { fileInputRef, open, isProcessing, handleFileSelected, handleImageEvent };
}
