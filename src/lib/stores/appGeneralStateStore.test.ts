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
      useAppGeneralStateStore.setState({ isDrawerOpen: false, isDrawerExpanded: false, isDrawerReceded: false });
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

describe('appGeneralStateStore See-Workspace recede', () => {
   beforeEach(() => {
      useAppGeneralStateStore.setState({ isDrawerOpen: false, isDrawerExpanded: false, isDrawerReceded: false });
   });

   it('setDrawerReceded recedes (dwell) and re-expands (the out / drag end)', () => {
      actions().expandDrawer();
      actions().setDrawerReceded(true);
      expect(get().isDrawerReceded).toBe(true);
      actions().setDrawerReceded(false); // dwelling the re-expand edge, or drag end / cancel
      expect(get().isDrawerReceded).toBe(false);
   });

   it('contracting clears a recede left over from a drag', () => {
      actions().expandDrawer();
      actions().setDrawerReceded(true);
      actions().contractDrawer();
      expect(get().isDrawerReceded).toBe(false);
      expect(get().isDrawerExpanded).toBe(false);
   });

   it('closing clears a recede', () => {
      actions().expandDrawer();
      actions().setDrawerReceded(true);
      actions().setDrawerOpen(false);
      expect(get().isDrawerReceded).toBe(false);
   });

   it('a fresh expand never starts receded', () => {
      actions().expandDrawer();
      actions().setDrawerReceded(true);
      actions().contractDrawer();
      actions().expandDrawer();
      expect(get().isDrawerReceded).toBe(false);
   });
});
