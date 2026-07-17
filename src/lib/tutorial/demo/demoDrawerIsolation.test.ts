// -- Library Imports --
import { beforeEach, describe, expect, it, vi } from 'vitest';

// -- Under Test --
import { seedDemo, teardownDemo } from './demoContentHandler';
import { disposeDemoDrawer, isDemoDrawerActive } from './demoDrawerBackend';

// -- Drawer Data Layer Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import * as repository from '@/lib/drawer/drawerRepository';
import {
   createReorderItemsCommand,
   drawerCommandEngine,
   getActiveDrawerEngine,
} from '@/lib/drawer/drawerCommandEngine';
import * as folderTree from '@/lib/drawer/drawerFolderTree';

// -- Type Imports --
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * The demo drawer's isolation guarantee, proven rather than argued: while a lesson runs, NO drawer edit reaches
 * the user's real library - not the write, not the undo history that describes it - and the routing always comes
 * home, including when teardown fails partway.
 *
 * These assert against a real (fake-indexeddb) repository holding real records, so a leak shows up as the
 * user's own rows changing rather than as a mocked call count.
 */

const CONTENT = { id: 'content', label: 'content' } as unknown as DrawerItemContent;

/** Two real root items, in a known order, standing in for the user's own library. */
async function seedRealLibrary(): Promise<string[]> {
   const first = await repository.createItem({ name: 'Real One', game: 'LEGENDS', type: 'NOTE', content: CONTENT, parentFolderId: null });
   const second = await repository.createItem({ name: 'Real Two', game: 'LEGENDS', type: 'NOTE', content: CONTENT, parentFolderId: null });
   return [first.id, second.id];
}

/** The real root items' ids in stored order, read straight from Dexie so no routing can colour the answer. */
async function realRootItemOrder(): Promise<string[]> {
   const items = await db.items.toArray();
   return items.sort((a, b) => a.order - b.order).map((item) => item.id);
}

beforeEach(async () => {
   await db.folders.clear();
   await db.items.clear();
   await db.meta.clear();
   disposeDemoDrawer();
   drawerCommandEngine.clear();
});

describe('demo drawer isolation', () => {
   it('routes a write to the fixture and leaves the real repository untouched', async () => {
      const realOrder = await seedRealLibrary();
      const handle = await seedDemo('drawer');

      // Reorder the demo library's own root items - the exact call the reorder beat's drag produces.
      const demoBefore = (await repository.getFolderItems(null)).map((item) => item.id);
      expect(demoBefore).toHaveLength(2);
      await getActiveDrawerEngine().execute(createReorderItemsCommand(null, 0, 1));

      // The demo moved...
      const demoAfter = (await repository.getFolderItems(null)).map((item) => item.id);
      expect(demoAfter).toEqual([demoBefore[1], demoBefore[0]]);
      // ...and the user's library did not. Neither the order nor the membership.
      expect(await realRootItemOrder()).toEqual(realOrder);

      await teardownDemo(handle);
      expect(await realRootItemOrder()).toEqual(realOrder);
   });

   it('leaves the real undo stack untouched, so a demo edit cannot be undone onto real data', async () => {
      const realOrder = await seedRealLibrary();
      const handle = await seedDemo('drawer');

      await getActiveDrawerEngine().execute(createReorderItemsCommand(null, 0, 1));
      // The demo's own engine took the history; the user's has nothing to undo.
      expect(getActiveDrawerEngine()).not.toBe(drawerCommandEngine);
      expect(getActiveDrawerEngine().canUndo()).toBe(true);
      expect(drawerCommandEngine.canUndo()).toBe(false);

      await teardownDemo(handle);

      // After the lesson the real engine is back, still with nothing to undo - so the user cannot replay a demo
      // operation onto their own records.
      expect(getActiveDrawerEngine()).toBe(drawerCommandEngine);
      expect(drawerCommandEngine.canUndo()).toBe(false);
      await drawerCommandEngine.undo();
      expect(await realRootItemOrder()).toEqual(realOrder);
   });

   it('serves the demo library to reads while it runs, and the real library again afterwards', async () => {
      await seedRealLibrary();
      const handle = await seedDemo('drawer');

      const demoItems = await repository.getFolderItems(null);
      expect(demoItems.map((item) => item.name)).toEqual(['The Sunken Vault', 'Rising Tide']);
      expect(await repository.getAllFolders()).toHaveLength(2);

      await teardownDemo(handle);

      const realItems = await repository.getFolderItems(null);
      expect(realItems.map((item) => item.name)).toEqual(['Real One', 'Real Two']);
      expect(await repository.getAllFolders()).toHaveLength(0);
   });

   it('clears the routing even when teardown throws partway', async () => {
      const handle = await seedDemo('drawer');
      expect(isDemoDrawerActive()).toBe(true);

      // Fail the rebuild that runs after the session is dropped: the drawer must still come home.
      const rebuild = vi.spyOn(folderTree, 'rebuildFolderTree').mockRejectedValueOnce(new Error('rebuild failed'));
      await expect(teardownDemo(handle)).rejects.toThrow('rebuild failed');
      rebuild.mockRestore();

      expect(isDemoDrawerActive()).toBe(false);
      expect(getActiveDrawerEngine()).toBe(drawerCommandEngine);
   });

   it('clears the routing even when the pre-teardown settle throws', async () => {
      const handle = await seedDemo('drawer');
      const settled = vi.spyOn(folderTree, 'whenFolderTreeSettled').mockRejectedValueOnce(new Error('settle failed'));
      await expect(teardownDemo(handle)).rejects.toThrow('settle failed');
      settled.mockRestore();

      expect(isDemoDrawerActive()).toBe(false);
      expect(getActiveDrawerEngine()).toBe(drawerCommandEngine);
   });

   it('sends a write made after teardown to the real repository', async () => {
      const realOrder = await seedRealLibrary();
      const handle = await seedDemo('drawer');
      await teardownDemo(handle);

      // The write both halves have to get right: it lands in Dexie, and on the user's own undo stack.
      await getActiveDrawerEngine().execute(createReorderItemsCommand(null, 0, 1));
      expect(await realRootItemOrder()).toEqual([realOrder[1], realOrder[0]]);
      expect(drawerCommandEngine.canUndo()).toBe(true);

      await drawerCommandEngine.undo();
      expect(await realRootItemOrder()).toEqual(realOrder);
   });

   it('leaves no live session when the seed throws after the fixture is installed', async () => {
      const realOrder = await seedRealLibrary();

      // The seed installs the session, then rebuilds the tree. A throw there used to leave the session live with
      // NO handle for anyone to tear down - routing on forever, with the user's next real save landing in a
      // fixture nobody reads. The seed has to clean up after itself, because nothing else can.
      const rebuild = vi.spyOn(folderTree, 'rebuildFolderTree').mockRejectedValueOnce(new Error('seed rebuild failed'));
      await expect(seedDemo('drawer')).rejects.toThrow('seed rebuild failed');
      rebuild.mockRestore();

      expect(isDemoDrawerActive()).toBe(false);
      expect(getActiveDrawerEngine()).toBe(drawerCommandEngine);

      // And the drawer is genuinely the user's again: the write lands in Dexie and on their own undo stack.
      await getActiveDrawerEngine().execute(createReorderItemsCommand(null, 0, 1));
      expect(await realRootItemOrder()).toEqual([realOrder[1], realOrder[0]]);
      expect(drawerCommandEngine.canUndo()).toBe(true);
   });

   it('refuses an import rather than letting one through to the real drawer', async () => {
      const handle = await seedDemo('drawer');
      await expect(repository.importNestedFolderAsRecords({ id: 'f', name: 'F', items: [], folders: [] }, null)).rejects.toThrow();
      expect(await db.folders.count()).toBe(0);
      await teardownDemo(handle);
   });
});
