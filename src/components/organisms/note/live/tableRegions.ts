// -- CodeMirror Imports --
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

/*
 * Shared GFM-table region detection off the Lezer syntax tree (the GFM `Table` extension is loaded in
 * `NoteEditor`). A single source of truth for "which byte ranges are table blocks", so the cover gutter can
 * refuse to inset a table (a table must never sit in the narrow cover gutter) and image insertion can redirect
 * out of a table (an image must never land in a cell). Uses the real `Table` node, NOT a `|` heuristic.
 */

/** The byte range of one GFM table block. */
export interface TableRegion {
   from: number;
   to: number;
}

/** All GFM table block ranges in the document, in source order. */
export function tableRegions(state: EditorState): TableRegion[] {
   const regions: TableRegion[] = [];
   syntaxTree(state).iterate({
      enter: (node) => {
         if (node.name === 'Table') regions.push({ from: node.from, to: node.to });
      },
   });
   return regions;
}

/** The table region that contains byte offset `pos` (its `[from, to]` span), or `null` if `pos` isn't in one. */
export function tableRegionAt(state: EditorState, pos: number): TableRegion | null {
   for (const region of tableRegions(state)) {
      if (pos >= region.from && pos <= region.to) return region;
   }
   return null;
}

/** True if the line starting at `lineStart` is part of any table block. */
export function isTableLine(state: EditorState, lineStart: number): boolean {
   return tableRegionAt(state, lineStart) !== null;
}
