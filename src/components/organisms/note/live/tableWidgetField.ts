// -- CodeMirror Imports --
import { Decoration, EditorView } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import type { EditorState, Range, Extension } from '@codemirror/state';

// -- Local Imports --
import { NoteTableWidget } from './tableWidget';
import { findTableBlocks } from '@/lib/notes/noteFormat';
import type { TableController } from './tableWidget';

/*
 * The Live-Preview TABLE decorations, sourced from a StateField (block decorations can't come from a
 * ViewPlugin - CM6 throws). Each GFM table block is replaced by a BLOCK widget rendering an editable grid, and
 * the field provides its ranges as ATOMIC so the caret steps over the whole table rather than into the pipes.
 *
 * Table detection is a parser-independent LINE SCAN (`findTableBlocks`), NOT the Lezer `Table` node: when a
 * `---` setext underline (or plain text) sits one `\n` below a table, the parser setext-ifies/absorbs the whole
 * block and the `Table` node vanishes - so a Lezer-only field would fail to grid it. The line scan always finds
 * the `| header |` + separator + rows, so the table is isolated as a grid regardless of what follows it.
 *
 * The buffer stays literal markdown: the widget's edits rebuild the block via the pure `noteFormat` table
 * helpers and dispatch at the block's live offsets (see `tableWidget.ts`).
 */

function buildTableDecorations(state: EditorState, controller: TableController): DecorationSet {
   const ranges: Range<Decoration>[] = [];
   const body = state.doc.toString();
   for (const { from, to } of findTableBlocks(body)) {
      if (to <= from) continue;
      const markdown = state.doc.sliceString(from, to);
      ranges.push(
         Decoration.replace({
            widget: new NoteTableWidget(markdown, from, to, controller),
            block: true,
         }).range(from, to),
      );
   }
   return Decoration.set(ranges, true);
}

/**
 * The block table-widget field, bound to the table controller (opens the right-click menu; injected once from
 * the React host). Rebuilt whenever the doc changes (selection is irrelevant - it's always the editable grid).
 */
export function tableWidgetField(controller: TableController): Extension {
   const field = StateField.define<DecorationSet>({
      create: (state) => buildTableDecorations(state, controller),
      update(deco, transaction) {
         if (transaction.docChanged) return buildTableDecorations(transaction.state, controller);
         return deco.map(transaction.changes);
      },
      provide: (f) => [
         EditorView.decorations.from(f),
         // The table block is atomic: the caret steps over the whole block, never into the raw pipes.
         EditorView.atomicRanges.of((view) => view.state.field(f, false) ?? Decoration.none),
      ],
   });
   return field;
}
