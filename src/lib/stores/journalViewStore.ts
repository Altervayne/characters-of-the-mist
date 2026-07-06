// -- Other Library Imports --
import { create } from 'zustand';

/*
 * Ephemeral UI state for journals: which page each journal is currently showing, keyed by the
 * journal's stable id. This is view state, NOT character data - it must not touch the shared
 * `Journal` aggregate, ride the character undo stack, or re-serialize the character on a page turn.
 *
 * A plain (NON-persisted) store: the value survives an in-session remount (the sheet unmounts on a
 * tab switch), which is the reported bug, but resets on reload - so there's no unbounded localStorage
 * Record to garbage-collect against deleted journals. Because it's keyed by the journal id, one store
 * serves BOTH the sheet journal and its board copy (same stable id, same map entry).
 */

interface JournalViewState {
   /** Current page index per journal id. */
   journalView: Record<string, number>;
   /** Records the page a journal is showing (a nav tick), synchronously so it survives the unmount. */
   setJournalPage: (journalId: string, index: number) => void;
}

export const useJournalViewStore = create<JournalViewState>((set) => ({
   journalView: {},
   setJournalPage: (journalId, index) =>
      set((state) => ({ journalView: { ...state.journalView, [journalId]: index } })),
}));
