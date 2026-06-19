// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Local Imports --
import {
   MORPH_DESCRIPTORS,
   SPRING_HOLD_MS,
   TAB_LANE_BELOW_PADDING,
   TAB_LANE_SIDE_PADDING,
   createSpringController,
   deriveDragContext,
   isOverTabLaneFor,
   isWithinTabLane,
   resolveSpringTarget,
   springDirection,
   type DragContext,
   type LaneRect,
   type SpringHitArea,
   type SpringTarget,
} from './dragFeedback';

/*
 * Unit tests for the drag-feedback geometry + context mapping (tabs polish-6).
 * The hook wiring (refs/listeners/puck) is exercised in the browser; these cover
 * the pure decision logic the prompt's acceptance criteria turn on.
 */

// A thin 40px-tall strip pinned to the top, mimicking the desktop tab strip.
const strip: LaneRect = { left: 100, right: 500, top: 0, bottom: 40, height: 40 };

describe('isWithinTabLane (generous hit zone)', () => {
   it('accepts a point squarely on the strip', () => {
      expect(isWithinTabLane(strip, 300, 20)).toBe(true);
   });

   it('accepts a low aim within the padded band below the strip', () => {
      // Band bottom = bottom(40) + height(40) + below(48) = 128.
      expect(isWithinTabLane(strip, 300, 120)).toBe(true);
      expect(isWithinTabLane(strip, 300, 128)).toBe(true);
   });

   it('accepts a sideways-slack aim just past the strip edges', () => {
      expect(isWithinTabLane(strip, strip.left - TAB_LANE_SIDE_PADDING, 20)).toBe(true);
      expect(isWithinTabLane(strip, strip.right + TAB_LANE_SIDE_PADDING, 20)).toBe(true);
   });

   it('rejects a point below the band (into the play area)', () => {
      const justBelow = strip.bottom + strip.height + TAB_LANE_BELOW_PADDING + 1;
      expect(isWithinTabLane(strip, 300, justBelow)).toBe(false);
   });

   it('rejects a point well outside the sideways slack', () => {
      expect(isWithinTabLane(strip, strip.right + TAB_LANE_SIDE_PADDING + 50, 20)).toBe(false);
   });
});

describe('isOverTabLaneFor (drag-kind guard)', () => {
   it('engages the lane for a drawer character in the band', () => {
      expect(isOverTabLaneFor('drawer-character', strip, 300, 120)).toBe(true);
   });

   it('does NOT engage for a component drag in the same band', () => {
      expect(isOverTabLaneFor('drawer-component', strip, 300, 120)).toBe(false);
   });

   it('does NOT engage for a tab, folder, or sheet item in the band', () => {
      expect(isOverTabLaneFor('tab', strip, 300, 120)).toBe(false);
      expect(isOverTabLaneFor('drawer-folder', strip, 300, 120)).toBe(false);
      expect(isOverTabLaneFor('sheet-item', strip, 300, 120)).toBe(false);
   });

   it('is false when the strip is unmounted (no rect)', () => {
      expect(isOverTabLaneFor('drawer-character', null, 300, 120)).toBe(false);
   });
});

describe('deriveDragContext (kind + over-zone → action)', () => {
   it('a character over the tab lane → open-tab (lane wins over play area)', () => {
      expect(deriveDragContext('drawer-character', 'play-area', true)).toBe('open-tab');
      expect(deriveDragContext('drawer-character', null, true)).toBe('open-tab');
   });

   it('a character over the play area (not the lane) → open', () => {
      expect(deriveDragContext('drawer-character', 'play-area', false)).toBe('open');
   });

   it('a component over the sheet → add-to-sheet', () => {
      expect(deriveDragContext('drawer-component', 'sheet', false)).toBe('add-to-sheet');
   });

   it('a sheet item over the drawer → save-to-drawer', () => {
      expect(deriveDragContext('sheet-item', 'drawer', false)).toBe('save-to-drawer');
   });

   it('plain reorders / non-actionable hovers → null', () => {
      expect(deriveDragContext('tab', null, false)).toBeNull();
      expect(deriveDragContext('drawer-folder', 'drawer', false)).toBeNull();
      expect(deriveDragContext('drawer-character', null, false)).toBeNull();
      expect(deriveDragContext('drawer-component', null, false)).toBeNull();
      expect(deriveDragContext('sheet-item', 'sheet', false)).toBeNull();
   });
});

// Three stacked 40px folder rows, with a Back button above them.
const back: LaneRect = { left: 0, right: 200, top: 0, bottom: 30, height: 30 };
const folders: SpringHitArea[] = [
   { id: 'f1', rect: { left: 0, right: 200, top: 40, bottom: 80, height: 40 } },
   { id: 'f2', rect: { left: 0, right: 200, top: 80, bottom: 120, height: 40 } },
   { id: 'f3', rect: { left: 0, right: 200, top: 120, bottom: 160, height: 40 } },
];

describe('resolveSpringTarget (dwell hit-test)', () => {
   it('resolves the folder under the cursor', () => {
      expect(resolveSpringTarget(folders, back, 100, 100, null)).toEqual({ kind: 'folder', id: 'f2' });
   });

   it('resolves Back first when over the Back button', () => {
      expect(resolveSpringTarget(folders, back, 100, 15, null)).toEqual({ kind: 'back' });
   });

   it('treats Back as absent at root (null rect)', () => {
      expect(resolveSpringTarget(folders, null, 100, 15, null)).toBeNull();
   });

   it('excludes the folder being dragged', () => {
      // Cursor squarely over f2, but f2 is the dragged folder → no target.
      expect(resolveSpringTarget(folders, back, 100, 100, 'f2')).toBeNull();
   });

   it('returns null over empty space', () => {
      expect(resolveSpringTarget(folders, back, 100, 500, null)).toBeNull();
   });
});

describe('springDirection (dwell → arrow)', () => {
   it('maps a folder target to the "in" arrow', () => {
      expect(springDirection({ kind: 'folder', id: 'f1' })).toBe('in');
   });

   it('maps the Back target to the "up" arrow', () => {
      expect(springDirection({ kind: 'back' })).toBe('up');
   });
});

describe('MORPH_DESCRIPTORS (context → descriptor)', () => {
   const contexts: NonNullable<DragContext>[] = ['open-tab', 'open', 'add-to-sheet', 'save-to-drawer'];

   it('resolves every drag context to a descriptor with an icon + label', () => {
      for (const context of contexts) {
         const descriptor = MORPH_DESCRIPTORS[context];
         expect(descriptor).toBeDefined();
         expect(descriptor.Icon).toBeTruthy(); // a lucide component (forwardRef object)
         expect(descriptor.labelKey).toMatch(/^DragPuck\./);
      }
   });

   it('carries the up arrow only for the directional open-tab context', () => {
      expect(MORPH_DESCRIPTORS['open-tab'].arrow).toBe('up');
      expect(MORPH_DESCRIPTORS.open.arrow).toBeUndefined();
      expect(MORPH_DESCRIPTORS['add-to-sheet'].arrow).toBeUndefined();
      expect(MORPH_DESCRIPTORS['save-to-drawer'].arrow).toBeUndefined();
   });
});

describe('createSpringController (dwell timer)', () => {
   beforeEach(() => vi.useFakeTimers());
   afterEach(() => vi.useRealTimers());

   const folderTarget: SpringTarget = { kind: 'folder', id: 'f1' };
   const otherTarget: SpringTarget = { kind: 'folder', id: 'f2' };
   const backTarget: SpringTarget = { kind: 'back' };

   it('fires navigation after holding the same target for SPRING_HOLD_MS', () => {
      const onNavigate = vi.fn();
      const controller = createSpringController({ onNavigate });

      controller.setTarget(folderTarget);
      vi.advanceTimersByTime(SPRING_HOLD_MS - 1);
      expect(onNavigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(folderTarget);
   });

   it('fires the Back target after the hold', () => {
      const onNavigate = vi.fn();
      const controller = createSpringController({ onNavigate });

      controller.setTarget(backTarget);
      vi.advanceTimersByTime(SPRING_HOLD_MS);
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(backTarget);
   });

   it('restarts the timer when the target changes (no nav to the first)', () => {
      const onNavigate = vi.fn();
      const controller = createSpringController({ onNavigate });

      controller.setTarget(folderTarget);
      vi.advanceTimersByTime(SPRING_HOLD_MS - 100); // not yet
      controller.setTarget(otherTarget); // switch before it fires
      vi.advanceTimersByTime(SPRING_HOLD_MS - 100); // would have fired the first by now
      expect(onNavigate).not.toHaveBeenCalledWith(folderTarget);
      vi.advanceTimersByTime(100); // complete the second hold
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(otherTarget);
   });

   it('does not restart while the same target is held continuously', () => {
      const onTargetChange = vi.fn();
      const controller = createSpringController({ onNavigate: vi.fn(), onTargetChange });

      controller.setTarget(folderTarget);
      controller.setTarget(folderTarget); // same target, repeated moves
      expect(onTargetChange).toHaveBeenCalledExactlyOnceWith('f1');
   });

   it('cancel() aborts a pending dwell (a drop before the hold wins)', () => {
      const onNavigate = vi.fn();
      const onTargetChange = vi.fn();
      const controller = createSpringController({ onNavigate, onTargetChange });

      controller.setTarget(folderTarget);
      vi.advanceTimersByTime(SPRING_HOLD_MS - 50);
      controller.cancel(); // drop happens here
      vi.advanceTimersByTime(SPRING_HOLD_MS);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(onTargetChange).toHaveBeenLastCalledWith(null);
   });

   it('a null target clears the affordance without navigating', () => {
      const onNavigate = vi.fn();
      const onTargetChange = vi.fn();
      const controller = createSpringController({ onNavigate, onTargetChange });

      controller.setTarget(folderTarget);
      controller.setTarget(null); // cursor left the row before the hold
      vi.advanceTimersByTime(SPRING_HOLD_MS);
      expect(onNavigate).not.toHaveBeenCalled();
      expect(onTargetChange).toHaveBeenLastCalledWith(null);
   });
});
