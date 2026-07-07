// -- React Imports --
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// -- CodeMirror Imports --
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// -- Live-Preview Imports --
import { liveInlineDecorations } from './live/liveDecorations';
import { imageWidgetField } from './live/imageWidgetField';
import { findImageTokens } from '@/lib/notes/noteImageHint';

/*
 * The Notes editor: a CodeMirror 6 surface over the flat markdown `body`. The CM6 document IS the buffer -
 * there is NO parse/serialise round-trip, so `noteImageHint`/`noteAssets`/export/GC/print keep reading the
 * exact string. `value` seeds the doc and reconciles EXTERNAL changes (a store undo, an image-insert splice,
 * a mode flip); every doc edit fires `onChange` with `doc.toString()` verbatim - no line-separator override,
 * no trim, no normalisation (Ada's byte-honesty contract).
 *
 * Phase 1 is SOURCE mode: markdown text with syntax highlighting, decorations OFF. Live Preview (inline
 * widgets + off-cursor syntax hiding) is a later phase; it layers a decoration extension onto this same view.
 *
 * Structural edits (image insertion, future hint/align rewrites) come in through the imperative {@link
 * NoteEditorHandle}: a caller dispatches a CM6 `changes` at real byte offsets, keeping undo granular and the
 * rest of the doc byte-identical - never a whole-doc replace.
 */

/** The imperative handle a caller (e.g. image insertion) uses to splice into the CM6 doc at real offsets. */
export interface NoteEditorHandle {
   /** The current caret offset (selection head), or the doc end when unfocused. */
   getCaret: () => number;
   /** The current document text, verbatim. */
   getValue: () => string;
   /** Replaces `[from, to)` with `insert`, optionally placing the caret at `selectAt`. Focuses the editor. */
   splice: (from: number, to: number, insert: string, selectAt?: number) => void;
}

interface NoteEditorProps {
   value: string;
   onChange: (next: string) => void;
   placeholder?: string;
   /** LIVE preview (inline syntax hide/reveal + mention pills + inline image widgets) vs SOURCE (plain markdown). */
   live: boolean;
   /** Native paste/drop handler for images (returns true when it consumed the event). Wired into CM6 dom events. */
   onImageEvent?: (event: ClipboardEvent | DragEvent) => boolean;
}

/*
 * The paper document palette drives every visible token. All colours are `currentColor`-translucent so they
 * inherit `--paper-foreground` - which means a custom theme's `--paper-*` reaches the editor for free, exactly
 * like `docMarkdownComponents`. Headings/emphasis carry weight/slant; punctuation stays quiet.
 */
const paperHighlight = HighlightStyle.define([
   { tag: tags.heading1, fontSize: '1.875em', fontWeight: 'bold' },
   { tag: tags.heading2, fontSize: '1.5em', fontWeight: 'bold' },
   { tag: tags.heading3, fontSize: '1.25em', fontWeight: '600' },
   { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600' },
   { tag: tags.strong, fontWeight: 'bold' },
   { tag: tags.emphasis, fontStyle: 'italic' },
   { tag: tags.strikethrough, textDecoration: 'line-through' },
   { tag: [tags.link, tags.url], color: 'currentColor', textDecoration: 'underline' },
   { tag: [tags.monospace], fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
   { tag: [tags.processingInstruction, tags.meta], opacity: '0.5' },
   { tag: tags.quote, fontStyle: 'italic', opacity: '0.9' },
]);

/* Strips CM6's default editor look so the parchment sheet is the only frame. Chrome would read as "text box". */
const paperTheme = EditorView.theme({
   '&': {
      backgroundColor: 'transparent',
      color: 'var(--paper-foreground)',
   },
   '&.cm-focused': { outline: 'none' },
   '.cm-scroller': {
      fontFamily: 'inherit',
      lineHeight: '1.625',
      overflow: 'visible',
   },
   '.cm-content': {
      padding: '0',
      caretColor: 'var(--paper-foreground)',
      // The reading measure, centred - matching NoteDocument's 68ch cap on the wider paper sheet.
      maxWidth: '68ch',
      marginInline: 'auto',
   },
   '.cm-line': { padding: '0' },
   '&.cm-editor .cm-cursor': { borderLeftColor: 'var(--paper-foreground)' },
   // Ink-on-parchment selection wash, never browser blue.
   '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--paper-foreground) 16%, transparent)',
   },
   '.cm-activeLine': { backgroundColor: 'transparent' },
   '.cm-placeholder': { color: 'var(--paper-foreground)', opacity: '0.4' },

   // ==================
   //  Live-Preview decoration classes (parity with docMarkdownComponents)
   // ==================
   // Heading lines: size + weight matching the doc map's h1..h4.
   '.cm-md-h1': { fontSize: '1.875em', fontWeight: 'bold', lineHeight: '1.2' },
   '.cm-md-h2': { fontSize: '1.5em', fontWeight: 'bold', lineHeight: '1.25' },
   '.cm-md-h3': { fontSize: '1.25em', fontWeight: '600' },
   '.cm-md-h4': { fontSize: '1.125em', fontWeight: '600' },
   // Inline marks: always-on styling for the content (the "live" in Live Preview).
   '.cm-md-strong': { fontWeight: 'bold' },
   '.cm-md-em': { fontStyle: 'italic' },
   '.cm-md-strike': { textDecoration: 'line-through', opacity: '0.8' },
   '.cm-md-code': { backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)', borderRadius: '0.25rem', padding: '0.1em 0.375em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' },
   '.cm-md-quote': { fontStyle: 'italic', opacity: '0.9' },
   // Syntax markers are COLLAPSED off-line via a zero-width replace (no class - no space, no cursor slot);
   // on the caret's line they render raw. So there is no marker opacity/reveal CSS here anymore.

   // ==================
   //  Inline image widget chrome (theme tokens; the image itself is content on paper)
   // ==================
   '.cm-note-image-selected': { outline: '2px solid var(--ring)', outlineOffset: '2px', borderRadius: '0.375rem' },
   '.cm-note-image-handle': { position: 'absolute', height: '0.75rem', width: '0.75rem', borderRadius: '0.125rem', backgroundColor: 'var(--primary)', border: '2px solid var(--primary-foreground)', boxShadow: '0 1px 2px rgb(0 0 0 / 0.2)', zIndex: '3' },
   // Single bottom-right handle (the only corner kept, mirroring the Board's resize handle).
   '.cm-note-image-handle-br': { bottom: '-0.375rem', right: '-0.375rem', cursor: 'nwse-resize' },
   '.cm-note-image-bar': { position: 'absolute', top: '-2.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.125rem', padding: '0.25rem', borderRadius: '0.375rem', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', zIndex: '4' },
   '.cm-note-image-align': { display: 'grid', placeItems: 'center', height: '1.75rem', width: '1.75rem', borderRadius: '0.25rem', cursor: 'pointer', color: 'inherit', background: 'transparent', border: 'none' },
   '.cm-note-image-align:hover': { backgroundColor: 'var(--muted)' },
   '.cm-note-image-align-active': { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' },
   '.cm-note-image-readout': { position: 'absolute', top: '0.25rem', right: '0.25rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: '0.75rem', boxShadow: '0 1px 2px rgb(0 0 0 / 0.2)', zIndex: '5' },
}, { dark: false });

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
   { value, onChange, placeholder, live, onImageEvent },
   ref,
) {
   const hostRef = useRef<HTMLDivElement>(null);
   const viewRef = useRef<EditorView | null>(null);
   // Latest-refs so the CM6 handlers (created once) always call the current closures.
   const onChangeRef = useRef(onChange);
   onChangeRef.current = onChange;
   const onImageEventRef = useRef(onImageEvent);
   onImageEventRef.current = onImageEvent;
   // The current doc, so a `live` flip can re-seed the rebuilt view with the latest buffer (not the stale prop).
   const valueRef = useRef(value);
   valueRef.current = value;

   // Rebuild the view when `live` flips (the extension set differs: Live adds the decoration engine + image
   // widgets). Seeded from the LIVE buffer so no edit is lost across the flip. Not rebuilt per keystroke.
   useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const view = new EditorView({
         state: EditorState.create({
            doc: valueRef.current,
            extensions: [
               history(),
               keymap.of([...defaultKeymap, ...historyKeymap]),
               markdown(),
               syntaxHighlighting(paperHighlight),
               EditorView.lineWrapping,
               paperTheme,
               placeholder ? cmPlaceholder(placeholder) : [],
               // LIVE mode: the Lezer inline decoration engine + the StateField image widgets.
               ...(live ? [liveInlineDecorations, imageWidgetField] : []),
               EditorView.updateListener.of((update) => {
                  if (update.docChanged) onChangeRef.current(update.state.doc.toString());
               }),
               // Route image paste/drop to the shared insertion pipeline; a non-image event falls through
               // to CM6's own paste/drop (plain text). `return true` means we consumed it.
               EditorView.domEventHandlers({
                  paste: (event) => onImageEventRef.current?.(event) ?? false,
                  drop: (event) => onImageEventRef.current?.(event) ?? false,
                  // Click on an image widget selects it: land the caret inside its token so the field marks it.
                  mousedown: (event, view) => selectImageOnClick(event, view),
               }),
            ],
         }),
         parent: host,
      });
      viewRef.current = view;

      return () => {
         // Commit-on-unmount: a tab switch unmounts with no blur, so flush the final buffer before destroy
         // (the debounced store write may not have fired). Idempotent - the parent's guard also flushes.
         onChangeRef.current(view.state.doc.toString());
         view.destroy();
         viewRef.current = null;
      };
      // `value`/`placeholder` are seed-only (read via the ref); external `value` changes flow through the
      // reconcile effect. Only `live` forces a rebuild.
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [live]);

   // Reconcile an EXTERNAL value change (store undo/redo, an insertion splice from a stale render, a mode
   // flip) into the doc. Skipped for the common case (the change originated here, so value already matches).
   useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (value === current) return;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
   }, [value]);

   useImperativeHandle(ref, (): NoteEditorHandle => ({
      getCaret: () => viewRef.current?.state.selection.main.head ?? 0,
      getValue: () => viewRef.current?.state.doc.toString() ?? '',
      splice: (from, to, insert, selectAt) => {
         const view = viewRef.current;
         if (!view) return;
         view.dispatch({
            changes: { from, to, insert },
            ...(selectAt !== undefined ? { selection: { anchor: selectAt } } : {}),
         });
         view.focus();
      },
   }), []);

   return <div ref={hostRef} className="note-editor text-base" />;
});

/**
 * Clicking a rendered image widget selects it: place the caret inside that image token's span so the image
 * StateField marks it selected (ring + handles + align bar appear). A click on the handle / align button is
 * ignored here (they stop propagation and own their gesture). Returns false so CM6 keeps its normal handling.
 */
function selectImageOnClick(event: MouseEvent, view: EditorView): boolean {
   const target = event.target as HTMLElement | null;
   if (!target) return false;
   if (target.closest('.cm-note-image-handle, .cm-note-image-align')) return false;
   const figure = target.closest('[data-note-image]') as HTMLElement | null;
   if (!figure) return false;
   const pos = view.posAtDOM(figure);
   const token = findImageTokens(view.state.doc.toString()).find((tk) => pos >= tk.index && pos <= tk.index + tk.length);
   if (!token) return false;
   event.preventDefault();
   view.dispatch({ selection: { anchor: token.index + 1 } });
   view.focus();
   return true;
}
