// -- React Imports --
import { createContext, useContext } from 'react';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';

/*
 * React Context carrying the ACTIVE board store instance to the canvas subtree (board-5).
 * Mirrors the character context, but the value is `BoardStore | null`: it is `null`
 * whenever the active tab is not a board (a character tab or the menu), so the hook
 * legitimately returns `null` and consumers tolerate it - there is no menu fallback for
 * boards.
 *
 * The context + hook live in this `.ts` file (no component export) so the provider,
 * which is a component, can live in its own `.tsx` without tripping
 * `react-refresh/only-export-components`.
 */

/** Holds the active board instance, or `null` when no board tab is active. */
export const ActiveBoardStoreContext = createContext<BoardStore | null>(null);

/**
 * Resolves the active board store instance from context, or `null` when the active tab
 * is not a board. Unlike the character hook this never throws: `null` is a valid state
 * (no board is open).
 */
export function useActiveBoardInstance(): BoardStore | null {
   return useContext(ActiveBoardStoreContext);
}
