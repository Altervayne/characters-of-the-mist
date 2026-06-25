// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Module under test + collaborators --
import * as harmonization from '@/lib/harmonization';
import * as drawerRepository from './drawerRepository';
import { drawerDatabase } from './drawerDatabase';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';
import {
   DrawerMigrationError,
   LEGACY_DRAWER_STORAGE_KEY,
   getLegacyBlobRemovalState,
   getLegacyDrawerForBackup,
   removeLegacyDrawerBlob,
   runDrawerMigrationIfNeeded,
} from './runDrawerMigration';

// -- Type Imports --
import type { DrawerItem, DrawerItemContent, Drawer } from '@/lib/types/drawer';

/*
 * Tests for the one-time drawer blob -> Dexie migration against fake-indexeddb
 * plus an in-memory localStorage shim (the Node test environment provides
 * neither IndexedDB nor localStorage on its own; fake-indexeddb/auto supplies the
 * former via setupFiles, this file supplies the latter).
 */

// ==================
//  In-memory localStorage shim (Node has no localStorage)
// ==================

function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   const shim: Storage = {
      get length() {
         return store.size;
      },
      clear() {
         store.clear();
      },
      getItem(key: string) {
         return store.has(key) ? store.get(key)! : null;
      },
      key(index: number) {
         return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
         store.delete(key);
      },
      setItem(key: string, value: string) {
         store.set(key, String(value));
      },
   };
   (globalThis as unknown as { localStorage: Storage }).localStorage = shim;
}

// ==================
//  Test data builders
// ==================

function makeItem(id: string, name: string): DrawerItem {
   return {
      id,
      game: 'LEGENDS',
      type: 'CHARACTER_CARD',
      name,
      content: { id: `content-${id}`, label: name } as unknown as DrawerItemContent,
   };
}

/** A representative nested drawer: root item, two root folders, a nested subfolder. */
function makeLegacyDrawer(): Drawer {
   return {
      folders: [
         {
            id: 'folder-campaign',
            name: 'Campaign',
            items: [makeItem('item-hero', 'Hero')],
            folders: [
               { id: 'folder-npcs', name: 'NPCs', items: [makeItem('item-villain', 'Villain')], folders: [] },
            ],
         },
         { id: 'folder-archive', name: 'Archive', items: [], folders: [] },
      ],
      rootItems: [makeItem('item-loose', 'Loose')],
   };
}

/** Writes a legacy zustand-persist blob (`{ state: { drawer }, version }`) into the shim. */
function seedLegacyBlob(drawer: Drawer): void {
   localStorage.setItem(LEGACY_DRAWER_STORAGE_KEY, JSON.stringify({ state: { drawer }, version: 3 }));
}

// ==================
//  Isolation
// ==================

beforeEach(async () => {
   installLocalStorageShim();
   await drawerDatabase.folders.clear();
   await drawerDatabase.items.clear();
   await drawerDatabase.meta.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});

// ==================
//  Flatten correctness
// ==================

describe('migration flatten correctness', () => {
   it('flattens the nested blob into records, preserving ids and contiguous order', async () => {
      seedLegacyBlob(makeLegacyDrawer());

      const outcome = await runDrawerMigrationIfNeeded();
      expect(outcome).toBe('migrated');

      // Root folders: preserved ids, contiguous order, root sentinel parent.
      const rootFolderCampaign = await drawerDatabase.folders.get('folder-campaign');
      const rootFolderArchive = await drawerDatabase.folders.get('folder-archive');
      expect(rootFolderCampaign).toMatchObject({ name: 'Campaign', parentFolderId: DRAWER_ROOT_PARENT_ID, order: 0 });
      expect(rootFolderArchive).toMatchObject({ name: 'Archive', parentFolderId: DRAWER_ROOT_PARENT_ID, order: 1 });

      // Nested subfolder: parent id preserved, order resets within its sibling set.
      const nestedFolder = await drawerDatabase.folders.get('folder-npcs');
      expect(nestedFolder).toMatchObject({ name: 'NPCs', parentFolderId: 'folder-campaign', order: 0 });

      // Items: ids + content preserved, parent + order correct.
      const looseItem = await drawerDatabase.items.get('item-loose');
      expect(looseItem).toMatchObject({ name: 'Loose', parentFolderId: DRAWER_ROOT_PARENT_ID, order: 0 });
      const heroItem = await drawerDatabase.items.get('item-hero');
      expect(heroItem).toMatchObject({ name: 'Hero', parentFolderId: 'folder-campaign', order: 0 });
      const villainItem = await drawerDatabase.items.get('item-villain');
      expect(villainItem).toMatchObject({ name: 'Villain', parentFolderId: 'folder-npcs', order: 0 });
      expect((villainItem?.content as unknown as { id: string }).id).toBe('content-item-villain'); // content preserved verbatim

      // Totals: nothing extra written.
      expect(await drawerDatabase.folders.count()).toBe(3);
      expect(await drawerDatabase.items.count()).toBe(3);
   });

   it('stamps every migrated item with one shared migration date-time (createdAt === updatedAt)', async () => {
      seedLegacyBlob(makeLegacyDrawer());
      vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

      await runDrawerMigrationIfNeeded();

      const items = await drawerDatabase.items.toArray();
      expect(items).toHaveLength(3);
      // History is unguessable, so all migrated items share the single migratedAt on both fields.
      for (const item of items) {
         expect(item.createdAt).toBe(1_700_000_000_000);
         expect(item.updatedAt).toBe(1_700_000_000_000);
      }
   });

   it('sets the schema version, completion flag, and retention marker, and leaves the blob in place', async () => {
      seedLegacyBlob(makeLegacyDrawer());

      await runDrawerMigrationIfNeeded();

      expect((await drawerDatabase.meta.get('migrationStatus'))?.value).toBe('completed');
      expect((await drawerDatabase.meta.get('schemaVersion'))?.value).toBe(1);
      expect((await drawerDatabase.meta.get('legacyBlobRetainedUntil'))?.value).toBeTruthy();

      // The legacy blob is RETAINED (removed only in a later release).
      expect(localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY)).not.toBeNull();
   });
});

// ==================
//  Harmonizer invocation
// ==================

describe('harmonizer', () => {
   it('invokes harmonizeData exactly once, for the full drawer', async () => {
      const harmonizeSpy = vi.spyOn(harmonization, 'harmonizeData');
      seedLegacyBlob(makeLegacyDrawer());

      await runDrawerMigrationIfNeeded();

      expect(harmonizeSpy).toHaveBeenCalledTimes(1);
      expect(harmonizeSpy).toHaveBeenCalledWith(expect.anything(), 'FULL_DRAWER');
   });
});

// ==================
//  Idempotency
// ==================

describe('idempotency', () => {
   it('is a no-op on a second run (gated on the completion flag)', async () => {
      seedLegacyBlob(makeLegacyDrawer());

      expect(await runDrawerMigrationIfNeeded()).toBe('migrated');
      const folderCountAfterFirst = await drawerDatabase.folders.count();

      // A second, different blob must NOT be re-imported once completed.
      seedLegacyBlob({ folders: [{ id: 'should-not-import', name: 'Nope', items: [], folders: [] }], rootItems: [] });
      expect(await runDrawerMigrationIfNeeded()).toBe('already-completed');

      expect(await drawerDatabase.folders.count()).toBe(folderCountAfterFirst);
      expect(await drawerDatabase.folders.get('should-not-import')).toBeUndefined();
   });

   it('de-duplicates concurrent (StrictMode double-mount) invocations into one run', async () => {
      const harmonizeSpy = vi.spyOn(harmonization, 'harmonizeData');
      seedLegacyBlob(makeLegacyDrawer());

      const [first, second] = await Promise.all([runDrawerMigrationIfNeeded(), runDrawerMigrationIfNeeded()]);

      expect(first).toBe('migrated');
      expect(second).toBe('migrated'); // same shared in-flight promise
      expect(harmonizeSpy).toHaveBeenCalledTimes(1);
      expect(await drawerDatabase.folders.count()).toBe(3); // no duplication
   });
});

// ==================
//  Failure handling
// ==================

describe('failure handling', () => {
   it('rolls back atomically on a forced mid-write failure, leaving the flag unset and blob untouched', async () => {
      seedLegacyBlob(makeLegacyDrawer());
      const bulkAddSpy = vi
         .spyOn(drawerDatabase.items, 'bulkAdd')
         .mockRejectedValueOnce(new Error('forced mid-transaction failure'));

      await expect(runDrawerMigrationIfNeeded()).rejects.toThrow();

      // Folders written before the failing items write are rolled back.
      expect(await drawerDatabase.folders.count()).toBe(0);
      // Flag stays unset so the next load retries.
      expect(await drawerDatabase.meta.get('migrationStatus')).toBeUndefined();
      // Legacy blob is never touched.
      expect(localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY)).not.toBeNull();

      bulkAddSpy.mockRestore();
   });

   it('aborts (defense in depth) when the stores are non-empty but the flag is unset', async () => {
      // Simulate stray/partial data without the completion flag.
      await drawerDatabase.folders.add({ id: 'stray', name: 'Stray', parentFolderId: DRAWER_ROOT_PARENT_ID, order: 0 });
      seedLegacyBlob(makeLegacyDrawer());

      await expect(runDrawerMigrationIfNeeded()).rejects.toBeInstanceOf(DrawerMigrationError);

      expect(await drawerDatabase.meta.get('migrationStatus')).toBeUndefined();
      expect(await drawerDatabase.folders.get('stray')).toBeDefined(); // pre-existing row untouched
   });
});

// ==================
//  Fresh install
// ==================

describe('fresh install', () => {
   it('marks completion without writing records when no legacy blob exists', async () => {
      const outcome = await runDrawerMigrationIfNeeded();

      expect(outcome).toBe('fresh-install');
      expect((await drawerDatabase.meta.get('migrationStatus'))?.value).toBe('completed');
      expect((await drawerDatabase.meta.get('schemaVersion'))?.value).toBe(1);
      expect(await drawerDatabase.folders.count()).toBe(0);
      expect(await drawerDatabase.items.count()).toBe(0);
   });
});

// ==================
//  Migration-time verification (Q1)
// ==================

describe('migration-time verification', () => {
   it('records migrationVerified + counts on a faithful migration', async () => {
      seedLegacyBlob(makeLegacyDrawer());

      await runDrawerMigrationIfNeeded();

      expect((await drawerDatabase.meta.get('migrationVerified'))?.value).toBe(true);
      // makeLegacyDrawer: 3 folders (Campaign, NPCs, Archive), 3 items (Hero, Villain, Loose).
      expect((await drawerDatabase.meta.get('migratedRecordCounts'))?.value).toEqual({ folders: 3, items: 3 });
   });

   it('fails closed (no migrationVerified) when the reconstructed tree mismatches the source', async () => {
      // Force the post-write reconstruction to differ from the source blob.
      vi.spyOn(drawerRepository, 'exportEntireDrawerAsNestedTree').mockResolvedValueOnce({ folders: [], rootItems: [] });
      seedLegacyBlob(makeLegacyDrawer());

      await expect(runDrawerMigrationIfNeeded()).rejects.toBeInstanceOf(DrawerMigrationError);

      // Data is still migrated and usable, but NOT verified, and the blob is retained.
      expect((await drawerDatabase.meta.get('migrationStatus'))?.value).toBe('completed');
      expect(await drawerDatabase.meta.get('migrationVerified')).toBeUndefined();
      expect(localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY)).not.toBeNull();
   });
});

// ==================
//  Legacy-blob removal gating (Q1-Q3)
// ==================

describe('legacy-blob removal gating', () => {
   it('is removable only after a verified migration with the blob still present', async () => {
      seedLegacyBlob(makeLegacyDrawer());
      await runDrawerMigrationIfNeeded();

      expect(await getLegacyBlobRemovalState()).toEqual({ removable: true, blobPresent: true });
   });

   it('is NOT removable when verification did not record the flag', async () => {
      vi.spyOn(drawerRepository, 'exportEntireDrawerAsNestedTree').mockResolvedValueOnce({ folders: [], rootItems: [] });
      seedLegacyBlob(makeLegacyDrawer());
      await runDrawerMigrationIfNeeded().catch(() => undefined);

      expect(await getLegacyBlobRemovalState()).toEqual({ removable: false, blobPresent: true });
   });

   it('is NOT removable when the blob is already gone', async () => {
      expect(await getLegacyBlobRemovalState()).toEqual({ removable: false, blobPresent: false });
   });

   it('produces a backup drawer for a valid blob and null for a corrupt one', async () => {
      seedLegacyBlob(makeLegacyDrawer());
      expect(getLegacyDrawerForBackup()?.folders.map((folder) => folder.name)).toEqual(['Campaign', 'Archive']);

      localStorage.setItem(LEGACY_DRAWER_STORAGE_KEY, '{ not valid json');
      expect(getLegacyDrawerForBackup()).toBeNull();
   });

   it('removeLegacyDrawerBlob removes the key + retention marker and is idempotent', async () => {
      seedLegacyBlob(makeLegacyDrawer());
      await runDrawerMigrationIfNeeded();
      expect((await drawerDatabase.meta.get('legacyBlobRetainedUntil'))?.value).toBeTruthy();

      await removeLegacyDrawerBlob();
      expect(localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY)).toBeNull();
      expect(await drawerDatabase.meta.get('legacyBlobRetainedUntil')).toBeUndefined();
      // After removal the blob is no longer removable.
      expect(await getLegacyBlobRemovalState()).toEqual({ removable: false, blobPresent: false });

      await removeLegacyDrawerBlob(); // idempotent: no throw
   });
});
