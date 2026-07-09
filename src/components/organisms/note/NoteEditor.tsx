// -- React Imports --
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// -- CodeMirror Imports --
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Strikethrough, Table } from '@lezer/markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// -- Live-Preview Imports --
import { liveInlineDecorations } from './live/liveDecorations';
import { imageWidgetField } from './live/imageWidgetField';
import { tableWidgetField } from './live/tableWidgetField';
import { coverGutter, setCoverEffect, coverInsetLineCount } from './live/coverGutter';
import { tableRegionAt } from './live/tableRegions';
import { formatToolbar } from './live/formatToolbar';
import { findImageTokens } from '@/lib/notes/noteImageHint';

// -- Type Imports --
import type { CoverController } from './live/coverGutter';
import type { FormatController } from './live/formatToolbar';
import type { TableController } from './live/tableWidget';
import type { NoteCover } from '@/lib/types/board';

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

/** The imperative handle a caller (e.g. image insertion, the permanent toolbar) uses to drive the CM6 doc. */
export interface NoteEditorHandle {
   /** The current caret offset (selection head), or the doc end when unfocused. */
   getCaret: () => number;
   /** The current selection range (`from`/`to`, `from === to` when collapsed). */
   getSelection: () => { from: number; to: number };
   /**
    * A safe body-image insertion offset: the caret, UNLESS it sits within the cover's inset lines (the first N
    * lines beside the cover), in which case the start of the first line PAST the cover region - so an inserted
    * image lands below the cover, never squeezed into its gutter. Falls back to the caret when there's no cover.
    */
   getInsertionPos: () => number;
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
   /** The note-level cover (Live only); rendered top-left with the opening lines inset beside it. */
   cover?: NoteCover;
   /** The cover controls' callbacks (Change/Remove + box commits). Bound into the Live cover gutter. */
   coverController: CoverController;
   /** The floating format bar's callbacks (Insert image + labels). Bound into Live and Source. */
   formatController: FormatController;
   /** The live table controller (opens the right-click context menu at a screen point with the cell's actions). */
   tableController: TableController;
   /** Native paste/drop handler for images (returns true when it consumed the event). Wired into CM6 dom events. */
   onImageEvent?: (event: ClipboardEvent | DragEvent) => boolean;
}

/*
 * The paper document palette drives every visible token. All colours are `currentColor`-translucent so they
 * inherit `--paper-foreground` - which means a custom theme's `--paper-*` reaches the editor for free, exactly
 * like `docMarkdownComponents`. Headings/emphasis carry weight/slant; punctuation stays quiet.
 */
const paperHighlight = HighlightStyle.define([
   // Heading SIZE comes only from the `.cm-md-h*` line classes (matching `docMarkdownComponents`); setting it
   // here too would compound the `em` against the already-sized line and blow headings up ~1.9x. Weight only.
   { tag: tags.heading1, fontWeight: 'bold' },
   { tag: tags.heading2, fontWeight: 'bold' },
   { tag: tags.heading3, fontWeight: '600' },
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
      // Anchors the absolute cover overlay (`.cm-note-cover`), which lives in the scroller so a CM6 content
      // redraw never wipes it.
      position: 'relative',
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
   // Heading lines: size + weight matching the doc map's h1..h4. H1 & H2 carry an UNDERLINE rule (a setext
   // heading's identity is its underline; Reading can't tell setext from ATX so both underline h1/h2, GitHub
   // convention) on the paper-border token so it's palette-adaptive. h3/h4 get no rule.
   '.cm-md-h1': { fontSize: '1.875em', fontWeight: 'bold', lineHeight: '1.2', borderBottom: '1px solid var(--paper-border)', paddingBottom: '0.25rem' },
   '.cm-md-h2': { fontSize: '1.5em', fontWeight: 'bold', lineHeight: '1.25', borderBottom: '1px solid var(--paper-border)', paddingBottom: '0.25rem' },
   '.cm-md-h3': { fontSize: '1.25em', fontWeight: '600' },
   '.cm-md-h4': { fontSize: '1.125em', fontWeight: '600' },
   // Inline marks: always-on styling for the content (the "live" in Live Preview).
   '.cm-md-strong': { fontWeight: 'bold' },
   '.cm-md-em': { fontStyle: 'italic' },
   '.cm-md-strike': { textDecoration: 'line-through', opacity: '0.8' },
   '.cm-md-code': { backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)', borderRadius: '0.25rem', padding: '0.1em 0.375em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9em' },
   // Blockquote as a callout BLOCK (left bar + subtle tint + padding), matching the Reading blockquote. Each
   // quote line takes this class; contiguous lines form one continuous block (border + tint run together).
   '.cm-md-quote-line': { borderLeft: '4px solid color-mix(in srgb, currentColor 40%, transparent)', backgroundColor: 'color-mix(in srgb, currentColor 5%, transparent)', paddingLeft: '1rem', paddingRight: '0.75rem', fontStyle: 'italic', opacity: '0.9' },
   // A rendered horizontal rule (replaces `---` off the cursor line), matching the Reading `<hr>`.
   '.cm-md-hr': { display: 'inline-block', width: '100%', height: '0', verticalAlign: 'middle', borderTop: '2px solid color-mix(in srgb, currentColor 25%, transparent)' },
   // List items: an indent (matching the Reading `pl-6`) + a rendered bullet / number via `::before`. Off the
   // caret's line the raw `- `/`1. ` collapses and the `::before` marker shows; on the caret's line the raw
   // marker stays (the `-ul`/`-ol` class is withheld there, so no double marker).
   '.cm-md-li': { paddingLeft: '1.5rem', position: 'relative' },
   '.cm-md-li-ul::before': { content: '"\\2022"', position: 'absolute', left: '0.4rem', color: 'currentColor' },
   '.cm-md-li-ol::before': { content: 'attr(data-num) "."', position: 'absolute', left: '0.1rem', color: 'currentColor', fontSize: '0.95em' },
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

   // ==================
   //  Cover box + hover controls (theme tokens; the cover image itself is content on paper)
   // ==================
   // The controls layer fades in on hover over the cover box; absolute, so it never shifts the document.
   '.cm-note-cover-controls': { position: 'absolute', inset: '0', opacity: '0', transition: 'opacity 120ms ease' },
   '.cm-note-cover:hover .cm-note-cover-controls': { opacity: '1' },
   '.cm-note-cover-bar': { position: 'absolute', top: '0.5rem', left: '0.5rem', display: 'flex', gap: '0.125rem', padding: '0.25rem', borderRadius: '0.375rem', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
   '.cm-note-cover-btn': { display: 'grid', placeItems: 'center', height: '1.75rem', width: '1.75rem', borderRadius: '0.25rem', cursor: 'pointer', color: 'inherit', background: 'transparent', border: 'none' },
   '.cm-note-cover-btn:hover': { backgroundColor: 'var(--muted)' },
   // The bottom-right box-width resize handle.
   '.cm-note-cover-handle': { position: 'absolute', bottom: '-0.375rem', right: '-0.375rem', height: '0.75rem', width: '0.75rem', borderRadius: '0.125rem', backgroundColor: 'var(--primary)', border: '2px solid var(--primary-foreground)', boxShadow: '0 1px 2px rgb(0 0 0 / 0.2)', cursor: 'nwse-resize' },

   // ==================
   //  Floating selection bar (theme tokens): Bold/Italic/Strike, shown on a non-empty selection.
   // ==================
   '.cm-note-format-bar': { position: 'absolute', zIndex: '7', display: 'flex', alignItems: 'center', gap: '0.125rem', padding: '0.25rem', borderRadius: '0.375rem', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
   '.cm-note-format-btn': { display: 'grid', placeItems: 'center', height: '1.75rem', width: '1.75rem', borderRadius: '0.25rem', cursor: 'pointer', color: 'inherit', background: 'transparent', border: 'none' },
   '.cm-note-format-btn:hover': { backgroundColor: 'var(--muted)' },

   // ==================
   //  Editable table grid - CLEAN cells (paper palette, parity with docMarkdownComponents). Insert-at-position,
   //  delete, and align live in the right-click menu; two full-edge hover "+" bars add a row / column.
   // ==================
   // Vertical spacing is top/bottom PADDING (not margin) so CM6's block-widget height-map counts it - else
   // lines below the table map a line high and the cursor is dishonest (the same fix the block image needed).
   // NO horizontal padding: the grid is FULL content width. The edge "+" bars are true overlays on the table's
   // own edges (they reserve no width), so the table equals the content column width.
   '.cm-note-table': { position: 'relative', padding: '0.75rem 0' },
   '.cm-note-table-grid': { width: '100%', borderCollapse: 'collapse', fontSize: '0.95em' },
   '.cm-note-table-grid th, .cm-note-table-grid td': { border: '1px solid color-mix(in srgb, currentColor 30%, transparent)', padding: '0.375rem 0.625rem', verticalAlign: 'top' },
   '.cm-note-table-grid th': { fontWeight: '600' },
   // Editable cells: no outline until focused, then a theme-ring so the active cell reads. `<br>` line breaks
   // render as real breaks (block display + pre-wrap).
   '.cm-note-table-cell': { display: 'block', minWidth: '2rem', minHeight: '1.25em', outline: 'none', cursor: 'text', whiteSpace: 'pre-wrap' },
   '.cm-note-table-cell:focus': { outline: '2px solid var(--ring)', outlineOffset: '-1px', borderRadius: '0.125rem' },
   // Full-edge add bars (theme tokens), subtle until hover - TRUE OVERLAYS on the table's own edges (reserve no
   // width). Bottom bar overlays the table's bottom edge, full table width (add row); right bar overlays the
   // right edge, full table height (add column). Sit within the top/bottom padding band so nothing overflows.
   '.cm-note-table-add-row-bar': { position: 'absolute', left: '0', right: '0', bottom: '0.125rem', height: '0.625rem', display: 'grid', placeItems: 'center', border: 'none', borderRadius: '0.25rem', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', opacity: '0', transition: 'opacity 120ms ease' },
   '.cm-note-table-add-col-bar': { position: 'absolute', top: '0.75rem', bottom: '0.75rem', right: '0', width: '0.625rem', display: 'grid', placeItems: 'center', border: 'none', borderRadius: '0.25rem', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', opacity: '0', transition: 'opacity 120ms ease' },
   '.cm-note-table:hover .cm-note-table-add-row-bar, .cm-note-table:hover .cm-note-table-add-col-bar': { opacity: '0.55' },
   '.cm-note-table-add-row-bar:hover, .cm-note-table-add-col-bar:hover': { opacity: '1', backgroundColor: 'color-mix(in srgb, var(--primary) 18%, transparent)', color: 'var(--foreground)' },
   '.cm-note-table-add-plus': { fontSize: '1rem', fontWeight: '700', lineHeight: '1' },
}, { dark: false });

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
   { value, onChange, placeholder, live, cover, coverController, formatController, tableController, onImageEvent },
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
   // The current cover, to seed a rebuilt view and reconcile external changes (set/change/clear cover).
   const coverRef = useRef(cover);
   coverRef.current = cover;
   // A latest-ref for the controller, wrapped in a STABLE controller so the gutter (built once) always calls
   // the current callbacks - a re-render swaps the closures without rebuilding the view.
   const controllerRef = useRef(coverController);
   controllerRef.current = coverController;
   const stableController = useRef<CoverController>({
      get editable() { return controllerRef.current.editable; },
      get labels() { return controllerRef.current.labels; },
      onChange: () => controllerRef.current.onChange(),
      onRemove: () => controllerRef.current.onRemove(),
      onResizeBox: (w, a) => controllerRef.current.onResizeBox(w, a),
      onSetAspect: (a) => controllerRef.current.onSetAspect(a),
   }).current;
   // Same stable-ref pattern for the format bar controller (the view is built once; a re-render swaps closures).
   const formatControllerRef = useRef(formatController);
   formatControllerRef.current = formatController;
   const stableFormatController = useRef<FormatController>({
      get editable() { return formatControllerRef.current.editable; },
      get labels() { return formatControllerRef.current.labels; },
   }).current;
   // The table controller, captured stably so the field (built once) always calls the current opener - a
   // re-render swaps the closure without rebuilding the view.
   const tableControllerRef = useRef(tableController);
   tableControllerRef.current = tableController;
   const stableTableController = useRef<TableController>({
      openContextMenu: (request) => tableControllerRef.current.openContextMenu(request),
      get labels() { return tableControllerRef.current.labels; },
   }).current;

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
               // GFM Strikethrough + Table so the Lezer tree yields their nodes - the base CommonMark parser
               // doesn't, so `~~text~~` never styles and a table block never renders as a grid in Live.
               markdown({ extensions: [Strikethrough, Table] }),
               syntaxHighlighting(paperHighlight),
               EditorView.lineWrapping,
               paperTheme,
               placeholder ? cmPlaceholder(placeholder) : [],
               // The floating format bar (Bold/Italic/Strike over a selection + Insert image at the caret) - in
               // both Live and Source, since both are editing surfaces.
               formatToolbar(stableFormatController),
               // LIVE mode: the Lezer inline decoration engine + the StateField image/table widgets + the cover gutter.
               ...(live ? [liveInlineDecorations, imageWidgetField, tableWidgetField(stableTableController), coverGutter(stableController)] : []),
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

      // Seed the cover gutter with the current cover (Live only; the field ignores it in Source).
      if (live && coverRef.current) view.dispatch({ effects: setCoverEffect.of(coverRef.current) });

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

   // Reconcile an external cover change (Add / Change / Remove / box resize / aspect) into the Live gutter
   // without a rebuild. The store hands a fresh `cover` object on every change, so identity tracks it. In
   // Source the cover field is absent, so the effect is a harmless no-op.
   useEffect(() => {
      const view = viewRef.current;
      if (!view || !live) return;
      view.dispatch({ effects: setCoverEffect.of(cover ?? null) });
   }, [cover, live]);

   useImperativeHandle(ref, (): NoteEditorHandle => ({
      getCaret: () => viewRef.current?.state.selection.main.head ?? 0,
      getSelection: () => {
         const range = viewRef.current?.state.selection.main;
         return { from: range?.from ?? 0, to: range?.to ?? 0 };
      },
      getInsertionPos: () => {
         const view = viewRef.current;
         if (!view) return 0;
         const { state } = view;
         const caret = state.selection.main.head;

         // A body image must never land inside a TABLE cell (renders as a broken blob). If the caret is in a
         // table block, redirect to the start of the first line PAST the table (or doc end).
         const table = tableRegionAt(state, caret);
         if (table) {
            const tableEndLine = state.doc.lineAt(table.to).number;
            return tableEndLine >= state.doc.lines ? state.doc.length : state.doc.line(tableEndLine + 1).from;
         }

         // Nor in the COVER gutter (the first N inset lines beside the cover).
         const insetLines = coverInsetLineCount(state);
         if (insetLines <= 0) return caret;
         const caretLine = state.doc.lineAt(caret).number;
         if (caretLine > insetLines) return caret; // caret is already past the cover region
         // Push the insertion to the start of the first line after the cover (or doc end if the cover covers all).
         if (insetLines >= state.doc.lines) return state.doc.length;
         return state.doc.line(insetLines + 1).from;
      },
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
