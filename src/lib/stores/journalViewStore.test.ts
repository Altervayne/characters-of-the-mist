// -- Library Imports --
import { describe, expect, it, beforeEach } from 'vitest';

// -- Local Imports --
import { useJournalViewStore } from './journalViewStore';

/*
 * The ephemeral journal-page store: an id-keyed map of the current page per journal, surviving an
 * in-session remount (so it must be plain module state, read/written by id).
 */

beforeEach(() => {
   useJournalViewStore.setState({ journalView: {} });
});

describe('journalViewStore', () => {
   it('records a page per journal id', () => {
      useJournalViewStore.getState().setJournalPage('j1', 3);
      expect(useJournalViewStore.getState().journalView['j1']).toBe(3);
   });

   it('keeps separate pages for separate journals (one map serves every surface)', () => {
      useJournalViewStore.getState().setJournalPage('j1', 2);
      useJournalViewStore.getState().setJournalPage('j2', 5);
      expect(useJournalViewStore.getState().journalView).toEqual({ j1: 2, j2: 5 });
   });

   it('overwrites a journal\'s page on a later nav tick', () => {
      useJournalViewStore.getState().setJournalPage('j1', 1);
      useJournalViewStore.getState().setJournalPage('j1', 4);
      expect(useJournalViewStore.getState().journalView['j1']).toBe(4);
   });

   it('survives a "remount": the value persists across reads without a mounted component', () => {
      useJournalViewStore.getState().setJournalPage('j1', 7);
      // No component lifecycle here - the value lives in module state, so a fresh read still sees it.
      expect(useJournalViewStore.getState().journalView['j1']).toBe(7);
   });
});
