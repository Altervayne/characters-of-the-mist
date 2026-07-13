// -- React Imports --
import { createContext, useContext } from 'react';

/*
 * React Context carrying the ids of strokes the current eraser scrub has crossed, so a drawing layer can
 * hide them the instant the eraser touches them - before the gesture commits on pointer-up. The set is
 * transient canvas state (the same family as the in-flight stroke preview): empty whenever no scrub is
 * active, and the removal only becomes real (persisted, undoable) when the whole scrub ends as one step.
 *
 * The context + hook live in this `.ts` file so the provider stays in its own `.tsx` without tripping
 * `react-refresh/only-export-components`.
 */

/** A stable empty set, so an idle board never re-renders its drawing layers for an absent scrub. */
export const EMPTY_STROKE_IDS: ReadonlySet<string> = new Set();

/** Holds the stroke ids hidden mid-scrub; empty when no erase is in progress. */
export const PendingEraseContext = createContext<ReadonlySet<string>>(EMPTY_STROKE_IDS);

/** The stroke ids the active eraser scrub has crossed (hidden on contact); empty when idle. */
export function usePendingErase(): ReadonlySet<string> {
   return useContext(PendingEraseContext);
}
