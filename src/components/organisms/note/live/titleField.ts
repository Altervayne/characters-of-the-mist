// -- CodeMirror Imports --
import { Facet, StateEffect, StateField } from '@codemirror/state';
import { invertedEffects } from '@codemirror/commands';
import type { EditorState, Extension } from '@codemirror/state';

/*
 * The note TITLE as CM6 state, so it shares the ONE undo timeline with the body (doc) and the cover. The title
 * is not a body token - it is a note property (a leading H1 on export) - but routing its edits through a
 * StateEffect that `history()` can invert lets body/title/cover undos interleave in the correct order.
 *
 * Mechanism (the documented CM6 "undoable effects" pattern): a `setTitleEffect` updates {@link titleField}; an
 * `invertedEffects` registration hands `history()` the effect that restores the PREVIOUS title, so an undo
 * that reverts a title edit re-applies it. The title never touches the document, so it can't merge with a
 * body-typing history group (effect-only transactions are always their own event) - each title commit is its
 * own clean undo step.
 */

/** Seeds {@link titleField}'s initial value at state creation (no dispatch, so it makes no history entry). */
export const initialTitle = Facet.define<string, string>({ combine: (values) => (values.length ? values[0] : '') });

/** Sets the note title. Dispatched (history-captured) when the title input edits or an undo/redo reverts it. */
export const setTitleEffect = StateEffect.define<string>();

/** Holds the current note title. Read by the editor's sync listener to mirror it back to the store + input. */
export const titleField = StateField.define<string>({
   create: (state) => state.facet(initialTitle),
   update(value, transaction) {
      let next = value;
      for (const effect of transaction.effects) {
         if (effect.is(setTitleEffect)) next = effect.value;
      }
      return next;
   },
});

/** Tells `history()` how to undo a title edit: restore the title as it was before this transaction. */
const titleHistory = invertedEffects.of((transaction) => {
   for (const effect of transaction.effects) {
      if (effect.is(setTitleEffect)) return [setTitleEffect.of(transaction.startState.field(titleField))];
   }
   return [];
});

/** The current note title held in CM6 state (empty string before seeding). */
export function getNoteTitle(state: EditorState): string {
   return state.field(titleField, false) ?? '';
}

/** The title-as-CM6-state extension: the field + its history inversion. Always loaded (title edits in Live AND Source). */
export const titleStateExtension: Extension = [titleField, titleHistory];
