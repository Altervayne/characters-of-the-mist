// -- CodeMirror Imports --
import { syntaxTree } from '@codemirror/language';

// -- Type Imports --
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

/*
 * Shared inline markdown-link lookup for the Live/Source editor: from a document position, find the enclosing
 * Lezer `Link` node and return its range + parsed label/href. One place so the mod-click follow, the Live chip
 * decorations, and the caret link-edit bar all read a link the same way (and can't drift on the grammar).
 */

/** A resolved inline markdown link `[label](href)`: the whole node range, the label range, and its parts. */
export interface LinkNodeInfo {
   /** The whole `[label](href)` span. */
   from: number;
   to: number;
   /** The label text between `[` and `]`. */
   label: string;
   /** The label's range (inside the brackets) - the target of an in-place label edit. */
   labelFrom: number;
   labelTo: number;
   /** The destination inside the parentheses. */
   href: string;
}

/** The seed a link-edit action hands the picker to REPLACE a link's target while keeping its label. */
export interface LinkEditSeed {
   from: number;
   to: number;
   label: string;
   href: string;
}

/** Parses a raw `[label](href)` token into its label + href, or null when the text isn't an inline link. */
export function parseLinkRaw(raw: string): { label: string; href: string } | null {
   const match = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(raw);
   return match ? { label: match[1], href: match[2] } : null;
}

/** Walks up from `node` to the enclosing `Link` node, or null when there is none. */
export function enclosingLink(node: SyntaxNode | null): SyntaxNode | null {
   for (let current = node; current; current = current.parent) {
      if (current.name === 'Link') return current;
   }
   return null;
}

/**
 * The inline markdown link enclosing `pos`, or null when the position isn't inside one. Resolves from both
 * sides of the position (a chip widget replaces the raw text, so a click can land at the span edge). A
 * reference-style / malformed link (not the `[text](href)` shape) returns null.
 */
export function linkNodeAt(state: EditorState, pos: number): LinkNodeInfo | null {
   const tree = syntaxTree(state);
   const node = enclosingLink(tree.resolveInner(pos, -1)) ?? enclosingLink(tree.resolveInner(pos, 1));
   if (!node) return null;
   const raw = state.doc.sliceString(node.from, node.to);
   const parsed = parseLinkRaw(raw);
   if (!parsed) return null;
   const labelFrom = node.from + 1; // just past the opening `[`
   return { from: node.from, to: node.to, label: parsed.label, labelFrom, labelTo: labelFrom + parsed.label.length, href: parsed.href };
}

/** The link under a COLLAPSED caret (an empty selection inside a link), or null - the caret link-edit bar's trigger. */
export function collapsedLinkAt(state: EditorState): LinkNodeInfo | null {
   const selection = state.selection.main;
   if (!selection.empty) return null;
   return linkNodeAt(state, selection.head);
}
