// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- CodeMirror Imports --
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';

// -- Units Under Test --
import { parseLinkRaw, linkNodeAt, collapsedLinkAt } from '@/components/organisms/note/live/linkNode';

/*
 * The shared markdown-link lookup that feeds the mod-click follow, the Live chip decorations, and the caret
 * link-edit bar. Pinned headless (an EditorState + the markdown Lezer tree, no DOM/view): the enclosing-link
 * detection + range math must be exact, or the bar edits or unwraps the wrong span.
 */

/** A headless markdown state with an optional collapsed caret. */
function stateWith(doc: string, caret?: number): EditorState {
   return EditorState.create({
      doc,
      selection: caret !== undefined ? { anchor: caret } : undefined,
      extensions: [markdown()],
   });
}

describe('parseLinkRaw', () => {
   it('splits a `[label](href)` token into its parts', () => {
      expect(parseLinkRaw('[the details](#overview)')).toEqual({ label: 'the details', href: '#overview' });
      expect(parseLinkRaw('[x](cotm://note/abc)')).toEqual({ label: 'x', href: 'cotm://note/abc' });
      expect(parseLinkRaw('[](https://a.b)')).toEqual({ label: '', href: 'https://a.b' });
   });

   it('returns null for text that is not an inline link', () => {
      expect(parseLinkRaw('the details')).toBeNull();
      expect(parseLinkRaw('[no parens]')).toBeNull();
      expect(parseLinkRaw('(no brackets)')).toBeNull();
   });
});

describe('linkNodeAt', () => {
   // "see [the details](#overview) here" - link node spans [4, 28); label "the details" is [5, 16).
   const doc = 'see [the details](#overview) here';

   it('resolves the enclosing link + its label range from a caret inside it', () => {
      const info = linkNodeAt(stateWith(doc), 8);
      expect(info).toEqual({ from: 4, to: 28, label: 'the details', labelFrom: 5, labelTo: 16, href: '#overview' });
      // The reported ranges slice back to exactly the token / label.
      expect(doc.slice(4, 28)).toBe('[the details](#overview)');
      expect(doc.slice(5, 16)).toBe('the details');
   });

   it('reads external and cotm hrefs verbatim', () => {
      expect(linkNodeAt(stateWith('[a](https://example.com/x)'), 1)?.href).toBe('https://example.com/x');
      expect(linkNodeAt(stateWith('[a](cotm://item/drw9)'), 1)?.href).toBe('cotm://item/drw9');
   });

   it('returns null when the position is outside any link', () => {
      expect(linkNodeAt(stateWith(doc), 30)).toBeNull(); // in the trailing " here"
      expect(linkNodeAt(stateWith('plain text, no link'), 4)).toBeNull();
   });
});

describe('collapsedLinkAt', () => {
   const doc = 'see [the details](#overview) here';

   it('returns the link under an empty caret inside it', () => {
      expect(collapsedLinkAt(stateWith(doc, 8))?.href).toBe('#overview');
   });

   it('returns null for a NON-empty selection (the format bar owns that state)', () => {
      const state = EditorState.create({ doc, selection: { anchor: 5, head: 16 }, extensions: [markdown()] });
      expect(collapsedLinkAt(state)).toBeNull();
   });

   it('returns null for an empty caret outside any link', () => {
      expect(collapsedLinkAt(stateWith(doc, 30))).toBeNull();
   });
});
