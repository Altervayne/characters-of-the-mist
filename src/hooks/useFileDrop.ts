// -- React Imports --
import { useCallback, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type RefObject } from 'react';

/*
 * Native file drag-and-drop + click-to-pick, over HTML5 DnD and a hidden `<input type="file">`. Replaces
 * react-dropzone for the app's JSON/`.md`/theme import sites (images already hand-roll their own native input).
 * Return shape mirrors the pieces those sites used - `getRootProps`, `getInputProps`, `isDragActive`,
 * `openPicker` - so call sites stay mechanical.
 *
 * Two details carry the behaviour: `onDragOver` MUST preventDefault or the browser navigates to the dropped
 * file, and a drag-depth counter (not a naive boolean) suppresses the nested-child dragenter/leave flicker.
 * The `accept` gate is advisory (extension-only, case-insensitive) - every call site re-validates on parse.
 */

interface UseFileDropOptions {
   /** Receives the accepted files (sliced to one unless `multiple`). Never called with an empty list. */
   onFiles: (files: File[]) => void;
   /** Comma-separated extension list, e.g. `.cotm,.json,.md`. Feeds the input `accept` and the extension gate. */
   accept?: string;
   /** Allow more than one file; when false (default) the drop/pick is sliced to the first file. */
   multiple?: boolean;
   /** Ignore every drag/drop/pick while true. */
   disabled?: boolean;
   /** Drop-only: omit the root `onClick` picker trigger. Default true (most sites open the picker elsewhere). */
   noClick?: boolean;
}

interface RootProps {
   onDragEnter: (event: DragEvent<HTMLElement>) => void;
   onDragOver: (event: DragEvent<HTMLElement>) => void;
   onDragLeave: (event: DragEvent<HTMLElement>) => void;
   onDrop: (event: DragEvent<HTMLElement>) => void;
   onClick?: () => void;
}

interface InputProps {
   ref: RefObject<HTMLInputElement | null>;
   type: 'file';
   accept?: string;
   multiple: boolean;
   disabled: boolean;
   style: CSSProperties;
   onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface UseFileDropResult {
   isDragActive: boolean;
   getRootProps: () => RootProps;
   getInputProps: () => InputProps;
   openPicker: () => void;
}

/** Extract the extension tokens (leading `.`, lowercased) from an `accept` string; MIME tokens are dropped. */
export function parseAcceptExtensions(accept?: string): string[] {
   return (accept ?? '')
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.startsWith('.'));
}

/** Keep files whose name ends in an allowed extension. An empty list means "no gate" (accept everything). */
export function filterAcceptedFiles(files: File[], extensions: string[]): File[] {
   if (extensions.length === 0) return files;
   return files.filter((file) => {
      const name = file.name.toLowerCase();
      return extensions.some((extension) => name.endsWith(extension));
   });
}

/** The drag-depth counter transitions. `enter`/`leave` balance across nested children; `drop` resets to 0. */
export function reduceDragDepth(depth: number, event: 'enter' | 'leave' | 'drop'): number {
   if (event === 'enter') return depth + 1;
   if (event === 'leave') return Math.max(0, depth - 1);
   return 0;
}

export function useFileDrop({ onFiles, accept, multiple = false, disabled = false, noClick = true }: UseFileDropOptions): UseFileDropResult {
   const [isDragActive, setIsDragActive] = useState(false);
   const depthRef = useRef(0);
   const inputRef = useRef<HTMLInputElement | null>(null);

   const extensions = useMemo(() => parseAcceptExtensions(accept), [accept]);

   const deliver = useCallback((fileList: FileList | null) => {
      if (!fileList) return;
      const accepted = filterAcceptedFiles(Array.from(fileList), extensions);
      const sliced = multiple ? accepted : accepted.slice(0, 1);
      if (sliced.length > 0) onFiles(sliced);
   }, [extensions, multiple, onFiles]);

   const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      depthRef.current = reduceDragDepth(depthRef.current, 'enter');
      setIsDragActive(true);
   }, [disabled]);

   const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      // Mandatory: without it the drop falls through to the browser, which navigates to the file.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
   }, [disabled]);

   const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      depthRef.current = reduceDragDepth(depthRef.current, 'leave');
      if (depthRef.current === 0) setIsDragActive(false);
   }, [disabled]);

   const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      depthRef.current = reduceDragDepth(depthRef.current, 'drop');
      setIsDragActive(false);
      deliver(event.dataTransfer?.files ?? null);
   }, [disabled, deliver]);

   const openPicker = useCallback(() => {
      if (disabled) return;
      inputRef.current?.click();
   }, [disabled]);

   const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
      deliver(event.target.files);
      // Clear so re-picking the same file fires `change` again (was the call sites' `formRef.reset()`).
      event.target.value = '';
   }, [deliver]);

   const getRootProps = useCallback((): RootProps => ({
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
      ...(noClick ? {} : { onClick: openPicker }),
   }), [onDragEnter, onDragOver, onDragLeave, onDrop, noClick, openPicker]);

   const getInputProps = useCallback((): InputProps => ({
      ref: inputRef,
      type: 'file',
      accept,
      multiple,
      disabled,
      style: { display: 'none' },
      onChange,
   }), [accept, multiple, disabled, onChange]);

   return { isDragActive, getRootProps, getInputProps, openPicker };
}
