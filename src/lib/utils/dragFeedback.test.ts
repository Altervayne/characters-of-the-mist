// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   TAB_LANE_BELOW_PADDING,
   TAB_LANE_SIDE_PADDING,
   deriveDragContext,
   isOverTabLaneFor,
   isWithinTabLane,
   type LaneRect,
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
