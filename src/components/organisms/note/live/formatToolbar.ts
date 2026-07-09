// -- CodeMirror Imports --
import { EditorView, ViewPlugin } from '@codemirror/view';
import type { ViewUpdate, PluginValue } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

// -- Local Imports --
import { computeWrapToggle, FORMAT_MARKERS } from '@/lib/notes/noteFormat';
import type { FormatKind } from '@/lib/notes/noteFormat';

/*
 * The floating SELECTION bar for the Live/Source editor (Wren's selection-toolbar design): Bold / Italic /
 * Strikethrough, shown only on a NON-EMPTY selection, floating just above it. The tools come to the text you
 * touched. It applies to the selection by rewriting the markdown via `view.dispatch` (the buffer stays literal
 * markdown - wrap `**`/`*`/`~~`, toggle off if already wrapped).
 *
 * Non-selection actions (Insert image / table / list / heading / quote) live in the PERMANENT editor toolbar
 * above the paper document (see `NoteView`), NOT here. Imperative DOM (no React root); chrome on theme tokens.
 */

/** The callbacks the selection bar needs. Injected once via {@link formatToolbar}; a stable wrapper keeps the view. */
export interface FormatController {
   /** Whether the surface shows the selection bar (Live/Source editing; never Reading). */
   editable: boolean;
   /** Localized tooltips/aria-labels for the icon-only controls (the plugin has no i18n of its own). */
   labels: { bold: string; italic: string; strikethrough: string };
}

/**
 * Applies a format toggle to the main selection via `view.dispatch` so the buffer stays literal markdown and
 * undo stays granular. The grammar lives in `noteFormat`; this only dispatches. No-op on an empty selection.
 */
function toggleWrap(view: EditorView, kind: FormatKind): void {
   const range = view.state.selection.main;
   const edit = computeWrapToggle(view.state.doc.toString(), range.from, range.to, FORMAT_MARKERS[kind]);
   if (!edit) return;
   view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: edit.selection,
   });
   view.focus();
}

/** lucide-ish format glyphs as inline SVG (imperative DOM, no React). */
const BOLD_GLYPH =
   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/></svg>';
const ITALIC_GLYPH =
   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4h-9M14 20H5M15 4L9 20"/></svg>';
const STRIKE_GLYPH =
   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M16 6a4 4 0 0 0-4-2H9a3 3 0 0 0 0 6M8 18a4 4 0 0 0 4 2h3a3 3 0 0 0 1-5.8"/></svg>';

/** Builds one icon control button. mousedown is swallowed so the editor keeps its selection/caret. */
function buildButton(glyph: string, label: string, onClick: () => void): HTMLButtonElement {
   const btn = document.createElement('button');
   btn.type = 'button';
   btn.className = 'cm-note-format-btn';
   btn.title = label;
   btn.setAttribute('aria-label', label);
   btn.innerHTML = glyph;
   btn.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); };
   btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
   return btn;
}

/** The overlay ViewPlugin: owns the floating selection bar, shown/positioned on a non-empty selection. */
function formatOverlay(controller: FormatController) {
   return ViewPlugin.fromClass(
      class implements PluginValue {
         private bar: HTMLElement;

         constructor(view: EditorView) {
            this.bar = document.createElement('div');
            this.bar.className = 'cm-note-format-bar';
            this.bar.style.display = 'none';
            this.bar.setAttribute('contenteditable', 'false');
            this.bar.appendChild(buildButton(BOLD_GLYPH, controller.labels.bold, () => toggleWrap(view, 'bold')));
            this.bar.appendChild(buildButton(ITALIC_GLYPH, controller.labels.italic, () => toggleWrap(view, 'italic')));
            this.bar.appendChild(buildButton(STRIKE_GLYPH, controller.labels.strikethrough, () => toggleWrap(view, 'strikethrough')));

            // Lives in the scroller (stable DOM; CM6 owns and reconciles `.cm-content`).
            view.scrollDOM.appendChild(this.bar);
            this.sync(view);
         }

         update(update: ViewUpdate) {
            if (update.selectionSet || update.docChanged || update.geometryChanged || update.viewportChanged || update.focusChanged) {
               this.sync(update.view);
            }
         }

         /**
          * Shows/hides the bar, then positions it in a `requestMeasure` - CM6 forbids reading layout
          * (`coordsAtPos`/`getBoundingClientRect`) during an update, so the geometry lands in the measure phase.
          * The display toggle is a plain style write (no layout read), safe here.
          */
         private sync(view: EditorView) {
            const showSelection = controller.editable && !view.state.selection.main.empty;
            this.bar.style.display = showSelection ? 'flex' : 'none';
            if (!showSelection) return;
            view.requestMeasure({
               read: () => {
                  const coords = view.coordsAtPos(view.state.selection.main.from);
                  return coords ? this.selectionPosition(view, coords) : null;
               },
               write: (pos) => {
                  if (!pos) {
                     // No coords for the selection anchor (off-screen): keep it hidden rather than mispositioned.
                     this.bar.style.display = 'none';
                     return;
                  }
                  this.bar.style.left = `${pos.left}px`;
                  this.bar.style.top = `${pos.top}px`;
               },
            });
         }

         /** The bar's target: above the selection start, flipping below near the scroller top; edge-clamped. */
         private selectionPosition(view: EditorView, coords: { left: number; top: number; bottom: number }): { left: number; top: number } {
            const scroller = view.scrollDOM;
            const scrollerRect = scroller.getBoundingClientRect();
            const barRect = this.bar.getBoundingClientRect();

            const rawTop = coords.top - scrollerRect.top + scroller.scrollTop - barRect.height - 8;
            const flipped = rawTop < scroller.scrollTop + 2;
            const top = flipped ? coords.bottom - scrollerRect.top + scroller.scrollTop + 8 : rawTop;
            let left = coords.left - scrollerRect.left + scroller.scrollLeft - barRect.width / 2;
            const maxLeft = scroller.clientWidth - barRect.width - 4;
            left = Math.max(4, Math.min(left, Math.max(4, maxLeft)));
            return { left, top };
         }

         destroy() {
            this.bar.remove();
         }
      },
   );
}

/** The floating selection bar extension (Live/Source), bound to a controller (format labels). */
export function formatToolbar(controller: FormatController): Extension {
   return [formatOverlay(controller)];
}
