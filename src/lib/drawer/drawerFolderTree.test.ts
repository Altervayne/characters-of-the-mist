// -- Library Imports --
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/*
 * Tests for the folder-tree cache: the pure index builder + selectors (children / breadcrumb / parent,
 * with sentinel<->null translation), and the module behavior - it RE-DERIVES from the repository on a
 * command-engine notify, and READING it (navigation) never re-queries.
 */

// Capture the engine subscription so a test can fire a "mutation" notify. Hoisted so the (hoisted)
// vi.mock factory can write to it without a temporal-dead-zone error.
const engineHolder = vi.hoisted(() => ({ callback: null as null | (() => void) }));
vi.mock('@/lib/drawer/drawerCommandEngine', () => ({
   drawerCommandEngine: {
      subscribe: vi.fn((cb: () => void) => {
         engineHolder.callback = cb;
         return () => {};
      }),
   },
}));

vi.mock('./drawerRepository', () => ({
   getAllFolders: vi.fn().mockResolvedValue([]),
}));

// -- Local Imports (after the mocks) --
import {
   buildFolderTreeIndex,
   selectChildFolders,
   selectBreadcrumb,
   selectParentFolderId,
   getChildFolders,
   getChildFolderCount,
   getBreadcrumb,
   getParentFolderId,
   rebuildFolderTree,
   whenFolderTreeSettled,
} from './drawerFolderTree';
import { getAllFolders } from './drawerRepository';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';
import type { DrawerFolderRecord } from './drawerRecords';

const f = (id: string, parentFolderId: string, order: number): DrawerFolderRecord => ({ id, name: id, parentFolderId, order });

// A small tree: two root folders (B before A by order), A -> A1 -> A1a.
const FIXTURE: DrawerFolderRecord[] = [
   f('A', DRAWER_ROOT_PARENT_ID, 1),
   f('B', DRAWER_ROOT_PARENT_ID, 0),
   f('A1', 'A', 0),
   f('A1a', 'A1', 0),
];

describe('folder-tree pure builder + selectors', () => {
   const index = buildFolderTreeIndex(FIXTURE);

   it('selectChildFolders returns the ordered children of a parent (null = root, sentinel translated)', () => {
      expect(selectChildFolders(index, null).map((folder) => folder.id)).toEqual(['B', 'A']); // by order
      expect(selectChildFolders(index, 'A').map((folder) => folder.id)).toEqual(['A1']);
      expect(selectChildFolders(index, 'A1a')).toEqual([]); // leaf
   });

   it('selectParentFolderId maps a top-level folder to null and a nested one to its parent', () => {
      expect(selectParentFolderId(index, 'A')).toBeNull(); // top-level -> null (sentinel hidden)
      expect(selectParentFolderId(index, 'A1')).toBe('A');
      expect(selectParentFolderId(index, null)).toBeNull();
      expect(selectParentFolderId(index, 'missing')).toBeNull();
   });

   it('selectBreadcrumb walks root -> folder (and is [] for root)', () => {
      expect(selectBreadcrumb(index, 'A1a').map((folder) => folder.id)).toEqual(['A', 'A1', 'A1a']);
      expect(selectBreadcrumb(index, 'A').map((folder) => folder.id)).toEqual(['A']);
      expect(selectBreadcrumb(index, null)).toEqual([]);
   });
});

describe('folder-tree module cache (re-derive on mutation, read on navigation)', () => {
   beforeEach(async () => {
      vi.clearAllMocks();
      (getAllFolders as Mock).mockResolvedValue(FIXTURE);
      // Settle the cache to the fixture before each test.
      await rebuildFolderTree();
   });

   it('a command-engine notify re-derives the cache from the repository', async () => {
      // Start from a single root folder...
      (getAllFolders as Mock).mockResolvedValue([f('Solo', DRAWER_ROOT_PARENT_ID, 0)]);
      await rebuildFolderTree();
      expect(getChildFolders(null).map((folder) => folder.id)).toEqual(['Solo']);

      // ...a mutation adds one; the engine notify rebuilds from the DB (re-derived, not patched).
      (getAllFolders as Mock).mockResolvedValue([
         f('Solo', DRAWER_ROOT_PARENT_ID, 0),
         f('Added', DRAWER_ROOT_PARENT_ID, 1),
      ]);
      expect(engineHolder.callback).toBeTypeOf('function');
      engineHolder.callback!();
      await whenFolderTreeSettled();

      expect(getChildFolders(null).map((folder) => folder.id)).toEqual(['Solo', 'Added']);
      expect(getChildFolderCount(null)).toBe(2);
   });

   it('reading the cache (navigation) never triggers a re-query', () => {
      const before = (getAllFolders as Mock).mock.calls.length;
      // Navigate around: child lists, counts, breadcrumb, parent - all pure reads.
      getChildFolders(null);
      getChildFolders('A');
      getChildFolderCount('A');
      getBreadcrumb('A1a');
      getParentFolderId('A1');
      expect((getAllFolders as Mock).mock.calls.length).toBe(before);
   });

   it('selectors reflect the settled fixture', () => {
      expect(getChildFolders(null).map((folder) => folder.id)).toEqual(['B', 'A']);
      expect(getBreadcrumb('A1').map((folder) => folder.id)).toEqual(['A', 'A1']);
      expect(getParentFolderId('A1')).toBe('A');
   });
});
