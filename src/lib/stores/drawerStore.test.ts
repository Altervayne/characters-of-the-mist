// -- Library Imports --
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/*
 * Tests for the drawer store's OPTIMISTIC reorder/move (tabs polish-16): the loaded
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
}));

// -- Local Imports (after the mocks so the store binds the mocked deps) --
import { useDrawerStore } from './drawerStore';
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';
import { getFolderChildren } from '@/lib/drawer/drawerRepository';
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';

const item = (id: string) => ({ id, name: id, parentFolderId: 'root', order: 0 }) as unknown as DrawerItemRecord;
const folder = (id: string) => ({ id, name: id, parentFolderId: 'root', order: 0 }) as DrawerFolderRecord;
const ids = (rows: { id: string }[] | undefined) => (rows ?? []).map((row) => row.id);

const seedItems = (rows: DrawerItemRecord[]) =>
   useDrawerStore.setState({ currentFolderId: null, currentFolderView: { folders: [], items: rows, childCounts: new Map() }, error: null });
const seedFolders = (rows: DrawerFolderRecord[]) =>
   useDrawerStore.setState({ currentFolderId: null, currentFolderView: { folders: rows, items: [], childCounts: new Map() }, error: null });

describe('drawerStore optimistic reorder/move (tabs polish-16)', () => {
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
