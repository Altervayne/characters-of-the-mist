// -- CodeMirror Imports --
import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import type { EditorState, ChangeSpec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';

/*
 * Tab / Shift+Tab = indent / outdent a LIST ITEM (the natural nesting gesture). On a list line the marker's
 * content width is the indent step - 2 spaces for a bullet (`- `), 3 for `1. ` - which is exactly what BOTH
 * parsers (Lezer for Live, remark-gfm for Reading) need to nest a `ListItem`. Indent is clamped so a line can't
 * nest deeper than one level below the line above it (an orphan first item can't over-indent); outdent removes
 * one step down to column 0. A multi-line selection indents/outdents every list line it touches. When the caret
 * is NOT on a list line the handlers return false, leaving Tab's existing (non-list) behaviour untouched.
 */

/** A list item line: leading indent (1) + a bullet/ordered marker (2) + one delimiter space (3). */
const LIST_LINE_RE = /^(\s*)([-*+]|\d+\.)(\s)/;

/** The indent step for a list line = its marker width + the delimiter space (2 for `- `, 3 for `1. `). */
function stepFor(marker: string): number {
   return marker.length + 1;
}

/** The line numbers every selection range touches (deduped, ascending). */
function selectedLineNumbers(state: EditorState): number[] {
   const nums = new Set<number>();
   for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const last = state.doc.lineAt(range.to).number;
      for (let n = first; n <= last; n++) nums.add(n);
   }
   return [...nums].sort((a, b) => a - b);
}

/**
 * Whether line `n` may indent one level: the line ABOVE must be a list item at an indent >= this line's, so
 * this line can become its child (a first item, or one already nested under the line above, can't go deeper).
 */
function canIndent(state: EditorState, n: number, indent: number): boolean {
   if (n <= 1) return false;
   const prev = state.doc.line(n - 1);
   const pm = LIST_LINE_RE.exec(prev.text);
   if (!pm) return false; // the line above isn't a list item - this is the first item, can't over-indent
   return indent <= pm[1].length;
}

/** Indents (or outdents) every selected list line by one marker-width step. No-op / falls through if none. */
function shiftListLines(view: EditorView, outdent: boolean): boolean {
   const { state } = view;
   const doc = state.doc;
   const listLines = selectedLineNumbers(state).filter((n) => LIST_LINE_RE.test(doc.line(n).text));
   if (listLines.length === 0) return false; // not on a list line: let Tab do its normal (non-list) thing

   const changes: ChangeSpec[] = [];
   if (outdent) {
      // Outdent every selected list line by its own step (down to column 0) - a block shifts left as a unit.
      for (const n of listLines) {
         const line = doc.line(n);
         const m = LIST_LINE_RE.exec(line.text)!;
         const remove = Math.min(stepFor(m[2]), m[1].length);
         if (remove > 0) changes.push({ from: line.from, to: line.from + remove });
      }
   } else {
      // Indent: clamp on the FIRST selected list line (an orphan first item can't nest); if it can, indent ALL
      // selected list lines by their own step so a multi-line block nests together, preserving its structure.
      const first = doc.line(listLines[0]);
      const fm = LIST_LINE_RE.exec(first.text)!;
      if (canIndent(state, listLines[0], fm[1].length)) {
         for (const n of listLines) {
            const line = doc.line(n);
            const m = LIST_LINE_RE.exec(line.text)!;
            changes.push({ from: line.from, insert: ' '.repeat(stepFor(m[2])) });
         }
      }
   }

   if (changes.length > 0) view.dispatch(state.update({ changes })); // selection maps through the changes
   return true; // consume the Tab even when clamped, so focus doesn't jump out of the editor
}

/** The list indent/outdent keymap (Tab / Shift+Tab), only active on list lines. */
export const listIndentKeymap: Extension = keymap.of([
   { key: 'Tab', run: (view) => shiftListLines(view, false) },
   { key: 'Shift-Tab', run: (view) => shiftListLines(view, true) },
]);
