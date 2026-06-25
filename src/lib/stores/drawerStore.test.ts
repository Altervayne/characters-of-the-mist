// -- Library Imports --
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/*
 * Tests for the drawer store's OPTIMISTIC reorder/move: the loaded
 * `currentFolderView` must reflect the result the instant the action is called,
 * synchronously, before the (async) command + reload, and must revert to the real
 * order when the command fails. The command engine and repository are mocked so we
 * control the persist outcome (resolve vs reject) and the reverted view in isolation.
 */

// The store dispatches through the command engine and reloads via the repository, and
// marks itself modified on the general-state store, mock all three so the test drives
// only the optimistic view logic.
vi.mock('./appGeneralStateStore', () => ({
   useAppGeneralStateStore: { getState: () => ({ actions: { setLastModifiedStore: vi.fn() } }) },
}));

vi.mock('@/lib/drawer/drawerCommandEngine', () => ({
   drawerCommandEngine: {
      execute: vi.fn().mockResolvedValue(undefined),
      undo: vi.fn().mockResolvedValue(undefined),
      redo: vi.fn().mockResolvedValue(undefined),
      canUndo: () => false,
      canRedo: () => false,
      subscribe: vi.fn(),
   },
   createReorderItemsCommand: vi.fn(() => ({ label: 'reorder-item' })),
   createReorderFoldersCommand: vi.fn(() => ({ label: 'reorder-folder' })),
   createMoveItemCommand: vi.fn(() => ({ label: 'move-item' })),
   createMoveFolderCommand: vi.fn(() => ({ label: 'move-folder' })),
}));

vi.mock('@/lib/drawer/drawerRepository', () => ({
   getFolderChildren: vi.fn().mockResolvedValue({ folders: [], items: [] }),
   getBreadcrumbPath: vi.fn().mockResolvedValue([]),
   getChildCountsForFolders: vi.fn().mockResolvedValue(new Map()),
   queryItems: vi.fn().mockResolvedValue([]),
}));

// -- Local Imports (after the mocks so the store binds the mocked deps) --
import { useDrawerStore, activeSearchFilters, isSearchFilterActive } from './drawerStore';
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';
import { getFolderChildren, queryItems } from '@/lib/drawer/drawerRepository';
import type { DrawerItemSummary } from '@/lib/drawer/drawerRepository';
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';

const item = (id: string) => ({ id, name: id, parentFolderId: 'root', order: 0 }) as unknown as DrawerItemRecord;
const folder = (id: string) => ({ id, name: id, parentFolderId: 'root', order: 0 }) as DrawerFolderRecord;
const ids = (rows: { id: string }[] | undefined) => (rows ?? []).map((row) => row.id);

const seedItems = (rows: DrawerItemRecord[]) =>
   useDrawerStore.setState({ currentFolderId: null, currentFolderView: { folders: [], items: rows, childCounts: new Map() }, error: null });
const seedFolders = (rows: DrawerFolderRecord[]) =>
   useDrawerStore.setState({ currentFolderId: null, currentFolderView: { folders: rows, items: [], childCounts: new Map() }, error: null });

describe('drawerStore optimistic reorder/move', () => {
   beforeEach(() => {
      vi.clearAllMocks();
      (drawerCommandEngine.execute as Mock).mockResolvedValue(undefined);
      (getFolderChildren as Mock).mockResolvedValue({ folders: [], items: [] });
      useDrawerStore.setState({ currentFolderId: null, currentFolderView: null, error: null });
   });

   it('reorderItems applies the new order to currentFolderView synchronously', async () => {
      seedItems([item('a'), item('b'), item('c')]);
      const pending = useDrawerStore.getState().actions.reorderItems(null, 0, 2);
      // Asserted BEFORE awaiting: the optimistic `set` runs before the first await.
      expect(ids(useDrawerStore.getState().currentFolderView?.items)).toEqual(['b', 'c', 'a']);
      await pending;
   });

   it('reorderFolders applies the new order to currentFolderView synchronously', async () => {
      seedFolders([folder('a'), folder('b'), folder('c')]);
      const pending = useDrawerStore.getState().actions.reorderFolders(null, 2, 0);
      expect(ids(useDrawerStore.getState().currentFolderView?.folders)).toEqual(['c', 'a', 'b']);
      await pending;
   });

   it('moveItem removes the moved row from currentFolderView synchronously', async () => {
      seedItems([item('a'), item('b'), item('c')]);
      const pending = useDrawerStore.getState().actions.moveItem('b', 'dest');
      expect(ids(useDrawerStore.getState().currentFolderView?.items)).toEqual(['a', 'c']);
      await pending;
   });

   it('reverts the optimistic view and surfaces the error when the command fails', async () => {
      seedItems([item('a'), item('b'), item('c')]);
      (drawerCommandEngine.execute as Mock).mockRejectedValueOnce(new Error('persist failed'));
      // The revert reload returns the real, unchanged order.
      (getFolderChildren as Mock).mockResolvedValue({ folders: [], items: [item('a'), item('b'), item('c')] });

      await expect(useDrawerStore.getState().actions.reorderItems(null, 0, 2)).rejects.toThrow('persist failed');

      expect(ids(useDrawerStore.getState().currentFolderView?.items)).toEqual(['a', 'b', 'c']);
      expect(useDrawerStore.getState().error).not.toBeNull();
   });
});

describe('drawerStore search', () => {
   const summary = (id: string): DrawerItemSummary => ({
      id, name: id, type: 'CHARACTER_CARD', game: 'LEGENDS', parentFolderId: null, createdAt: 0, updatedAt: 0,
   });

   beforeEach(() => {
      vi.clearAllMocks();
      (queryItems as Mock).mockResolvedValue([]);
      useDrawerStore.setState({ searchCriteria: null, searchResults: null, isSearching: false });
   });

   it('applySearch runs the query, stores results, and clears the loading flag', async () => {
      (queryItems as Mock).mockResolvedValueOnce([summary('a'), summary('b')]);
      await useDrawerStore.getState().actions.applySearch({ text: 'a' });

      expect(queryItems).toHaveBeenCalledWith({ text: 'a' });
      expect(useDrawerStore.getState().searchCriteria).toEqual({ text: 'a' });
      expect(ids(useDrawerStore.getState().searchResults ?? undefined)).toEqual(['a', 'b']);
      expect(useDrawerStore.getState().isSearching).toBe(false);
   });

   it('applySearch leaves the browse view untouched (clearing search returns to the same folder)', async () => {
      seedItems([item('x'), item('y')]);
      const before = useDrawerStore.getState().currentFolderView;
      (queryItems as Mock).mockResolvedValueOnce([summary('a')]);
      await useDrawerStore.getState().actions.applySearch({ text: 'a' });

      expect(useDrawerStore.getState().currentFolderView).toBe(before); // same reference: browse untouched
   });

   it('clearSearch nulls the criteria and results', async () => {
      (queryItems as Mock).mockResolvedValueOnce([summary('a')]);
      await useDrawerStore.getState().actions.applySearch({ text: 'a' });
      useDrawerStore.getState().actions.clearSearch();

      expect(useDrawerStore.getState().searchCriteria).toBeNull();
      expect(useDrawerStore.getState().searchResults).toBeNull();
   });

   it('updateSearchCriteria merges a partial into the active criteria and re-applies', async () => {
      await useDrawerStore.getState().actions.applySearch({ text: 'detective' });
      (queryItems as Mock).mockClear();

      await useDrawerStore.getState().actions.updateSearchCriteria({ games: ['CITY_OF_MIST'] });

      // The text is preserved and the games filter is added (merge, not replace).
      expect(queryItems).toHaveBeenCalledWith({ text: 'detective', games: ['CITY_OF_MIST'] });
      expect(useDrawerStore.getState().searchCriteria).toEqual({ text: 'detective', games: ['CITY_OF_MIST'] });
   });

   it('updateSearchCriteria merges into an empty (null) criteria', async () => {
      useDrawerStore.setState({ searchCriteria: null });
      await useDrawerStore.getState().actions.updateSearchCriteria({ types: ['STATUS_TRACKER'] });
      expect(useDrawerStore.getState().searchCriteria).toEqual({ types: ['STATUS_TRACKER'] });
   });
});

describe('active-filter helpers', () => {
   it('isSearchFilterActive is true for any filter, false for null / empty / sort-only', () => {
      expect(isSearchFilterActive(null)).toBe(false);
      expect(isSearchFilterActive({})).toBe(false);
      expect(isSearchFilterActive({ text: '   ' })).toBe(false); // whitespace-only is not active
      expect(isSearchFilterActive({ types: [] })).toBe(false); // empty array = no constraint
      expect(isSearchFilterActive({ sort: { by: 'name', direction: 'asc' } })).toBe(false); // sort alone

      expect(isSearchFilterActive({ text: 'a' })).toBe(true);
      expect(isSearchFilterActive({ types: ['FULL_BOARD'] })).toBe(true);
      expect(isSearchFilterActive({ games: ['LEGENDS'] })).toBe(true);
      expect(isSearchFilterActive({ createdBetween: [0, 1] })).toBe(true);
      expect(isSearchFilterActive({ updatedBetween: [0, 1] })).toBe(true);
   });

   it('activeSearchFilters lists the active facets (for the count badge), excluding sort', () => {
      expect(activeSearchFilters({ text: 'a', games: ['LEGENDS'], sort: { by: 'name', direction: 'asc' } })).toEqual(['text', 'games']);
      expect(activeSearchFilters(null)).toEqual([]);
   });
});
