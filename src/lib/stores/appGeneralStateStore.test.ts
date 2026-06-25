// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { useAppGeneralStateStore } from './appGeneralStateStore';

/*
 * The drawer's three modes via two flags: Collapsed (!open), Open (open + !expanded), Expanded (open +
 * expanded). Closing must always drop Expanded too.
 */

const get = () => useAppGeneralStateStore.getState();
const actions = () => useAppGeneralStateStore.getState().actions;

describe('appGeneralStateStore drawer modes', () => {
   beforeEach(() => {
      useAppGeneralStateStore.setState({ isDrawerOpen: false, isDrawerExpanded: false });
   });

   it('opens to the side panel (open, not expanded)', () => {
      actions().setDrawerOpen(true);
      expect(get().isDrawerOpen).toBe(true);
      expect(get().isDrawerExpanded).toBe(false);
   });

   it('expandDrawer opens AND expands; contractDrawer returns to Open (still open)', () => {
      actions().expandDrawer();
      expect(get().isDrawerOpen).toBe(true);
      expect(get().isDrawerExpanded).toBe(true);

      actions().contractDrawer();
      expect(get().isDrawerOpen).toBe(true); // still open
      expect(get().isDrawerExpanded).toBe(false);
   });

   it('closing from Expanded drops both flags (close -> Collapsed)', () => {
      actions().expandDrawer();
      actions().setDrawerOpen(false);
      expect(get().isDrawerOpen).toBe(false);
      expect(get().isDrawerExpanded).toBe(false);
   });

   it('toggleDrawer closing from Expanded also clears expanded', () => {
      actions().expandDrawer();
      actions().toggleDrawer(); // open -> closed
      expect(get().isDrawerOpen).toBe(false);
      expect(get().isDrawerExpanded).toBe(false);
   });

   it('setDrawerExpanded is the raw setter (does not touch open)', () => {
      actions().setDrawerOpen(true);
      actions().setDrawerExpanded(true);
      expect(get().isDrawerExpanded).toBe(true);
      actions().setDrawerExpanded(false);
      expect(get().isDrawerExpanded).toBe(false);
      expect(get().isDrawerOpen).toBe(true);
   });
});
