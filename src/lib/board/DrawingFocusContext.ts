// -- React Imports --
import { createContext, useContext } from 'react';

/*
 * React Context carrying the id of the ACTIVE drawing layer while a drawing (append) gesture is armed, so a
 * drawing layer can dim itself when it is not the append target - a focus pull toward where the next stroke
 * lands. Null whenever the cue is off (Select or eraser mode, or no live active layer): no layer dims and no
 * active-layer box is drawn. Kept in its own `.ts` file (like the pending-erase context) so its provider
 * stays in a `.tsx` without tripping `react-refresh/only-export-components`.
 */

/** The active drawing layer's id while the focus cue is on; null when off (nothing dims). */
export const DrawingFocusContext = createContext<string | null>(null);

/** The id of the active drawing layer to keep at full opacity; null when the focus cue is off. */
export function useDrawingFocus(): string | null {
   return useContext(DrawingFocusContext);
}
