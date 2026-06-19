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

/** Whether a point falls inside a rect (inclusive edges). */
function pointInRect(rect: { left: number; right: number; top: number; bottom: number }, x: number, y: number): boolean {
   return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
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


// ==================
//  Spring-loaded drawer navigation (tabs polish-7)
// ==================

/**
 * How long (ms) the cursor must dwell on a folder/Back target before the drawer
 * navigates there mid-drag. MUST stay in sync with the `spring-fill` keyframe
 * duration in `global.css` (the progress affordance fills over the same window).
 */
export const SPRING_HOLD_MS = 800;

/** Sentinel key for the Back target (folders use their own id as the key). */
export const SPRING_BACK_KEY = '__drawer_back__';

/** A resolved dwell target: a specific folder, or the drawer's Back button. */
export type SpringTarget = { kind: 'folder'; id: string } | { kind: 'back' };

/** A folder row's id paired with its measured rect, for the dwell hit-test. */
export interface SpringHitArea {
   id: string;
   rect: LaneRect;
}

/** Stable key for a target (used to detect when the dwell target changes). */
export function springTargetKey(target: SpringTarget | null): string | null {
   if (!target) return null;
   return target.kind === 'back' ? SPRING_BACK_KEY : target.id;
}

/**
 * Resolves which dwell target (if any) the cursor is over, hit-testing the Back
 * button first then the visible folder rows. The folder currently being dragged is
 * excluded — you cannot drill into the thing you are holding — and Back is only a
 * target when its rect is supplied (the caller omits it at root, matching the Back
 * button's `disabled` gate).
 *
 * @param folders - The visible folder rows with their measured rects.
 * @param back - The Back button's rect, or null when at root / not rendered.
 * @param x - Cursor clientX.
 * @param y - Cursor clientY.
 * @param draggedFolderId - The id of the folder being dragged, or null.
 * @returns The dwell target under the cursor, or null.
 */
export function resolveSpringTarget(
   folders: SpringHitArea[],
   back: LaneRect | null,
   x: number,
   y: number,
   draggedFolderId: string | null,
): SpringTarget | null {
   if (back && pointInRect(back, x, y)) return { kind: 'back' };
   for (const folder of folders) {
      if (folder.id === draggedFolderId) continue;
      if (pointInRect(folder.rect, x, y)) return { kind: 'folder', id: folder.id };
   }
   return null;
}

/** Options for {@link createSpringController}. */
export interface SpringControllerOptions {
   /** Dwell duration; defaults to {@link SPRING_HOLD_MS}. */
   holdMs?: number;
   /** Fired when the dwell completes on a target (perform the navigation here). */
   onNavigate: (target: SpringTarget) => void;
   /** Fired whenever the active target key changes (drive the progress affordance). */
   onTargetChange?: (key: string | null) => void;
}

/** The dwell timer state machine returned by {@link createSpringController}. */
export interface SpringController {
   /** Feed the current hit-test result each pointer move (null = no target). */
   setTarget(target: SpringTarget | null): void;
   /** Abort any pending dwell and clear the affordance (drop / drag end / cancel). */
   cancel(): void;
}

/**
 * A small, DOM-free dwell timer: feed it the target under the cursor on every
 * pointer move and it (re)starts a hold timer, firing `onNavigate` only when the
 * SAME target is held for the full `holdMs`. Changing targets restarts the timer;
 * a `null` target or `cancel()` aborts it (so a drop before the hold wins). Kept
 * free of the DOM and React so the hold/restart/abort logic is unit-testable.
 *
 * @param options - Navigation + affordance callbacks and the optional hold time.
 * @returns A controller with `setTarget` / `cancel`.
 */
export function createSpringController(options: SpringControllerOptions): SpringController {
   const holdMs = options.holdMs ?? SPRING_HOLD_MS;
   let currentKey: string | null = null;
   let timer: ReturnType<typeof setTimeout> | null = null;

   const clearTimer = (): void => {
      if (timer !== null) {
         clearTimeout(timer);
         timer = null;
      }
   };

   return {
      setTarget(target) {
         const key = springTargetKey(target);
         if (key === currentKey) return; // same target: let the running timer continue
         clearTimer();
         currentKey = key;
         options.onTargetChange?.(key);
         if (target) {
            timer = setTimeout(() => {
               timer = null;
               currentKey = null;
               options.onTargetChange?.(null);
               options.onNavigate(target);
            }, holdMs);
         }
      },
      cancel() {
         clearTimer();
         if (currentKey !== null) {
            currentKey = null;
            options.onTargetChange?.(null);
         }
      },
   };
}
