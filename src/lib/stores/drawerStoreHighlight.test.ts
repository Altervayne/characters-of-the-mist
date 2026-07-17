// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The transient reveal highlight: `highlightItem` flags a row so its entry can scroll + pulse once, then
 * auto-clears the signal after the pulse window so nothing lingers (it is never persisted). A re-reveal
 * resets the timer. The pure classify/resolve is elsewhere; this proves the store's set-then-clear cycle.
 */

vi.mock('./appGeneralStateStore', () => ({
   useAppGeneralStateStore: { getState: () => ({ actions: { setLastModifiedStore: vi.fn() } }) },
}));

vi.mock('@/lib/drawer/drawerCommandEngine', () => {
   const engine = {
      execute: vi.fn().mockResolvedValue(undefined),
      undo: vi.fn().mockResolvedValue(undefined),
      redo: vi.fn().mockResolvedValue(undefined),
      canUndo: () => false,
      canRedo: () => false,
      subscribe: vi.fn(),
   };
   return {
      drawerCommandEngine: engine,
      getActiveDrawerEngine: () => engine,
      subscribeActiveDrawerEngine: vi.fn(),
   };
});

vi.mock('@/lib/drawer/drawerRepository', () => ({
   getFolderItems: vi.fn().mockResolvedValue([]),
   getItemCountsForFolders: vi.fn().mockResolvedValue(new Map()),
   queryItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/drawer/drawerFolderTree', () => ({
   getChildFolders: vi.fn(() => []),
   getChildFolderCount: vi.fn(() => 0),
   whenFolderTreeSettled: vi.fn().mockResolvedValue(undefined),
}));

// -- Local Imports (after the mocks so the store binds the mocked deps) --
import { useDrawerStore } from './drawerStore';

describe('drawerStore.highlightItem', () => {
   beforeEach(() => {
      vi.useFakeTimers();
      useDrawerStore.setState({ highlightItemId: null });
   });
   afterEach(() => {
      vi.useRealTimers();
   });

   it('sets the transient signal, then auto-clears it after the pulse window', () => {
      useDrawerStore.getState().actions.highlightItem('item-1');
      expect(useDrawerStore.getState().highlightItemId).toBe('item-1');

      // Not cleared before the window elapses.
      vi.advanceTimersByTime(1000);
      expect(useDrawerStore.getState().highlightItemId).toBe('item-1');

      // Cleared once the full window passes.
      vi.advanceTimersByTime(1000);
      expect(useDrawerStore.getState().highlightItemId).toBeNull();
   });

   it('resets the auto-clear timer on a re-reveal so the highlight lasts a full window', () => {
      useDrawerStore.getState().actions.highlightItem('item-1');
      vi.advanceTimersByTime(1500);
      // Re-reveal the same row just before it would clear.
      useDrawerStore.getState().actions.highlightItem('item-1');
      vi.advanceTimersByTime(1000);
      // The old timer was cancelled, so the signal is still set.
      expect(useDrawerStore.getState().highlightItemId).toBe('item-1');
      vi.advanceTimersByTime(1000);
      expect(useDrawerStore.getState().highlightItemId).toBeNull();
   });
});
