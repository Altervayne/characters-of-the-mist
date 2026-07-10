// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- CodeMirror Imports --
import { EditorState, Transaction } from '@codemirror/state';
import { history, undo, redo, undoDepth, redoDepth } from '@codemirror/commands';

// -- Units Under Test --
import { titleStateExtension, initialTitle, setTitleEffect, getNoteTitle } from '@/components/organisms/note/live/titleField';
import { coverStateExtension, initialCover, setCoverEffect, getNoteCover } from '@/components/organisms/note/live/coverGutter';

// -- Type Imports --
import type { NoteCover } from '@/lib/types/board';

/*
 * The note editor's ONE undo timeline: body (the CM6 doc), title, and cover share a single `history()` stack so
 * their undos interleave in the correct order. Title and cover are captured via `invertedEffects` (the documented
 * CM6 pattern), and - being effect-only transactions - each is its own clean history step (they never coalesce
 * into a body-typing group). This pins the reducer + inversion + interleaving without a DOM (headless state).
 */

const COVER_A: NoteCover = { hash: 'aaaaaa', width: 40, aspect: 1.2 };
const COVER_B: NoteCover = { hash: 'aaaaaa', width: 55, aspect: 1.2 };

/** A tiny driver over a headless EditorState so undo/redo (StateCommands) can run without a view. */
function driver(opts: { doc?: string; title?: string; cover?: NoteCover | null } = {}) {
   let state = EditorState.create({
      doc: opts.doc ?? '',
      extensions: [history(), titleStateExtension, initialTitle.of(opts.title ?? ''), coverStateExtension, initialCover.of(opts.cover ?? null)],
   });
   return {
      get title() { return getNoteTitle(state); },
      get cover() { return getNoteCover(state); },
      get doc() { return state.doc.toString(); },
      get undoDepth() { return undoDepth(state); },
      get redoDepth() { return redoDepth(state); },
      setTitle(next: string) {
         state = state.update({ effects: setTitleEffect.of(next), annotations: Transaction.userEvent.of('note.title') }).state;
      },
      setCover(next: NoteCover | null) {
         state = state.update({ effects: setCoverEffect.of(next), annotations: Transaction.userEvent.of('note.cover') }).state;
      },
      type(text: string, at: number) {
         state = state.update({ changes: { from: at, insert: text }, userEvent: 'input.type' }).state;
      },
      undo() { return undo({ state, dispatch: (tr) => { state = tr.state; } }); },
      redo() { return redo({ state, dispatch: (tr) => { state = tr.state; } }); },
   };
}

describe('note unified undo timeline', () => {
   it('seeds title + cover from facets without creating an undo step', () => {
      const d = driver({ doc: 'body', title: 'Seed', cover: COVER_A });
      expect(d.title).toBe('Seed');
      expect(d.cover).toEqual(COVER_A);
      expect(d.undoDepth).toBe(0);
      expect(d.undo()).toBe(false); // nothing on the stack from a load
   });

   it('undoes / redoes a title edit', () => {
      const d = driver({ title: 'Old' });
      d.setTitle('New');
      expect(d.title).toBe('New');
      d.undo();
      expect(d.title).toBe('Old');
      d.redo();
      expect(d.title).toBe('New');
   });

   it('undoes / redoes a cover edit (resize), and a clear', () => {
      const d = driver({ cover: COVER_A });
      d.setCover(COVER_B); // resize
      expect(d.cover).toEqual(COVER_B);
      d.undo();
      expect(d.cover).toEqual(COVER_A);
      d.redo();
      expect(d.cover).toEqual(COVER_B);
      d.setCover(null); // remove
      expect(d.cover).toBeNull();
      d.undo();
      expect(d.cover).toEqual(COVER_B);
   });

   it('HEADLINE: body -> title -> cover reverses as cover, title, body; redo re-applies in order', () => {
      const d = driver({ title: 'T0', cover: null });
      d.type('lore', 0); // 1: body
      d.setTitle('T1');  // 2: title
      d.setCover(COVER_A); // 3: cover
      expect([d.doc, d.title, d.cover]).toEqual(['lore', 'T1', COVER_A]);
      expect(d.undoDepth).toBe(3);

      d.undo(); // cover
      expect([d.doc, d.title, d.cover]).toEqual(['lore', 'T1', null]);
      d.undo(); // title
      expect([d.doc, d.title, d.cover]).toEqual(['lore', 'T0', null]);
      d.undo(); // body
      expect([d.doc, d.title, d.cover]).toEqual(['', 'T0', null]);

      d.redo(); // body
      expect(d.doc).toBe('lore');
      d.redo(); // title
      expect(d.title).toBe('T1');
      d.redo(); // cover
      expect(d.cover).toEqual(COVER_A);
      expect(d.redoDepth).toBe(0);
   });

   it('tracks undo/redo depth for the toolbar button enablement', () => {
      const d = driver();
      expect(d.undoDepth).toBe(0);
      d.setTitle('x');
      expect(d.undoDepth).toBe(1);
      expect(d.redoDepth).toBe(0);
      d.undo();
      expect(d.undoDepth).toBe(0);
      expect(d.redoDepth).toBe(1);
   });
});
