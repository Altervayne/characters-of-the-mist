// -- React Imports --
import { createContext, useContext } from 'react';

// -- Type Imports --
import type { NoteStore } from '@/lib/stores/noteStore';

/*
 * React Context carrying the ACTIVE note store instance to the Note tab surface. Mirrors
 * the board context: the value is `NoteStore | null` - `null` whenever the active tab is
 * not a note (a character/board tab or the menu), so the hook legitimately returns `null`
 * and consumers tolerate it (there is no menu fallback for notes).
 *
 * The context + hook live in this `.ts` file (no component export) so the provider, which
 * is a component, can live in its own `.tsx` without tripping
 * `react-refresh/only-export-components`.
 */

/** Holds the active note instance, or `null` when no note tab is active. */
export const ActiveNoteStoreContext = createContext<NoteStore | null>(null);

/**
 * Resolves the active note store instance from context, or `null` when the active tab is
 * not a note. Unlike the character hook this never throws: `null` is a valid state.
 */
export function useActiveNoteInstance(): NoteStore | null {
   return useContext(ActiveNoteStoreContext);
}
