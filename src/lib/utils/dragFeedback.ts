/**
 * Pure helpers for the drag-feedback layer (tabs polish-6): the generous tab-lane
 * hit test and the cross-surface context derivation. Kept free of React and
 * @dnd-kit so the geometry and the kind→context mapping can be unit-tested in
 * isolation, while {@link import('@/hooks/character-sheet/useCharacterSheetDnD')}
 * owns the stateful wiring (refs, listeners, the cursor puck).
 */

/** What is being dragged, classified once at drag start. */
export type DragKind =
   | 'drawer-character'
   | 'drawer-component'
   | 'drawer-folder'
   | 'sheet-item'
   | 'tab'
   | null;

/** The actionable surface the cursor is currently over (from @dnd-kit's `over`). */
export type DragOverZone = 'play-area' | 'sheet' | 'drawer' | null;

/** The action a drop would perform right now; drives the cursor puck (null = hidden). */
export type DragContext = 'open-tab' | 'open' | 'add-to-sheet' | 'save-to-drawer' | null;

/**
 * Sideways slack (px) added to each edge of the tab strip's measured rect so a
 * character aimed roughly at the lane still registers.
 */
export const TAB_LANE_SIDE_PADDING = 32;

/**
 * Downward slack (px) ADDED TO the strip's own height when extending the lane into
 * the top band, so a low aim is forgiven without reaching the play area proper.
 * The band's bottom edge is `rect.bottom + rect.height + TAB_LANE_BELOW_PADDING`.
 */
export const TAB_LANE_BELOW_PADDING = 48;

/** The minimal slice of a `DOMRect` the lane test needs. */
export interface LaneRect {
   left: number;
   right: number;
   top: number;
   bottom: number;
   height: number;
}

/**
 * Tests a cursor point against the tab strip's rect padded generously sideways and
 * (especially) downward into the top band — far more forgiving than @dnd-kit's thin
 * droppable. The band never reaches the play area: its bottom is the strip height
 * plus {@link TAB_LANE_BELOW_PADDING} below the strip.
 *
 * @param rect - The strip's `getBoundingClientRect()` (or a compatible shape).
 * @param x - Cursor clientX.
 * @param y - Cursor clientY.
 * @param sidePad - Sideways slack; defaults to {@link TAB_LANE_SIDE_PADDING}.
 * @param belowPad - Extra downward slack; defaults to {@link TAB_LANE_BELOW_PADDING}.
 * @returns Whether the point falls inside the padded lane.
 */
export function isWithinTabLane(
   rect: LaneRect,
   x: number,
   y: number,
   sidePad: number = TAB_LANE_SIDE_PADDING,
   belowPad: number = TAB_LANE_BELOW_PADDING,
): boolean {
   const bottom = rect.bottom + rect.height + belowPad;
   return x >= rect.left - sidePad && x <= rect.right + sidePad && y >= rect.top && y <= bottom;
}

/**
 * The generous lane only ever engages for a dragged drawer character — a component,
 * folder, tab, or sheet item passing through the same band must NOT register as a
 * tab-open. This guards the geometry test by drag kind.
 *
 * @param kind - The classified drag kind.
 * @param rect - The strip rect (null when the strip is unmounted).
 * @param x - Cursor clientX.
 * @param y - Cursor clientY.
 * @returns Whether the lane is engaged (always false unless `kind` is a character).
 */
export function isOverTabLaneFor(
   kind: DragKind,
   rect: LaneRect | null,
   x: number,
   y: number,
): boolean {
   if (kind !== 'drawer-character' || !rect) return false;
   return isWithinTabLane(rect, x, y);
}

/**
 * Maps the dragged kind + the current over-zone (+ the generous lane flag) to the
 * action a drop would perform. The lane takes precedence over the play area for a
 * character, so the top band reads as "Open as tab" even where it overlaps the
 * play-area drop zone. Returns null for plain reorders or non-actionable hovers.
 *
 * @param kind - The classified drag kind.
 * @param overZone - The @dnd-kit-derived surface under the cursor.
 * @param isOverTabLane - Whether the generous tab lane is engaged.
 * @returns The drag context (puck content), or null when nothing actionable.
 */
export function deriveDragContext(
   kind: DragKind,
   overZone: DragOverZone,
   isOverTabLane: boolean,
): DragContext {
   if (kind === 'drawer-character') {
      if (isOverTabLane) return 'open-tab';
      if (overZone === 'play-area') return 'open';
      return null;
   }
   if (kind === 'drawer-component') return overZone === 'sheet' ? 'add-to-sheet' : null;
   if (kind === 'sheet-item') return overZone === 'drawer' ? 'save-to-drawer' : null;
   return null;
}
