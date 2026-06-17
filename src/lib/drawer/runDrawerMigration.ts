// -- Utils Imports --
import { harmonizeData } from '@/lib/harmonization';
import { APP_VERSION } from '@/lib/config';

// -- Local Imports --
import { drawerDatabase } from './drawerDatabase';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord } from './drawerRecords';
import type { Drawer, DrawerItem, Folder } from '@/lib/types/drawer';

/*
 * One-time migration of the legacy localStorage drawer blob into the Phase 2
 * Dexie stores (migration spec §6). Additive: the app keeps reading the old
 * store; this only writes the Dexie copy and guards itself so it runs exactly
 * once. Ids are preserved (keeping `drawerItemId` links intact) and the legacy
 * key is retained for now (removed in a later release per resolved Q-4).
 */

/**
 * localStorage key of the legacy zustand-persist drawer blob (shape
 * `{ state: { drawer }, version }`). Exported so the later removal phase has a
 * single source of truth. NOT the `characterData` key (LegacyDataDialog) nor the
 * character-file import feature (MigrationDialog) — those are unrelated (§6.1).
 */
export const LEGACY_DRAWER_STORAGE_KEY = 'characters-of-the-mist_drawer-storage';

/**
 * The drawer's own schema version, written to `meta.schemaVersion`. Tracks the
 * Dexie `version(1)` declared in `drawerDatabase.ts`; the drawer no longer rides
 * on the shared `STORE_VERSION` (see spec §6.5 / Conflict C-2).
 */
const DRAWER_SCHEMA_VERSION = 1;

/** The result of an attempted migration run. */
export type DrawerMigrationOutcome = 'already-completed' | 'fresh-install' | 'migrated';

/** Thrown when the migration cannot proceed safely (e.g. non-empty stores without the flag). */
export class DrawerMigrationError extends Error {
   readonly code = 'DRAWER_MIGRATION_FAILED';
   constructor(message: string) {
      super(message);
      this.name = 'DrawerMigrationError';
   }
}

/**
 * In-flight run shared across concurrent callers. React StrictMode invokes
 * mount effects twice; both calls receive this single promise rather than racing
 * two migrations. Reset once settled so a failed run can be retried on the next
 * load.
 */
let inFlightMigration: Promise<DrawerMigrationOutcome> | null = null;

/** Narrows an unknown parsed value to the nested {@link Drawer} shape. */
function isDrawerShape(value: unknown): value is Drawer {
   return (
      !!value &&
      typeof value === 'object' &&
      Array.isArray((value as Drawer).folders) &&
      Array.isArray((value as Drawer).rootItems)
   );
}

/**
 * Reads and extracts the nested drawer from the legacy blob string. A blob that
 * cannot be parsed, or whose `state.drawer` is missing/misshapen, yields an empty
 * drawer: the migration then completes as a no-op while the blob is retained
 * untouched, so a corrupt blob never wedges startup in a permanent retry loop and
 * no data is destroyed.
 */
function extractDrawerFromBlob(rawBlob: string): Drawer {
   try {
      const parsed = JSON.parse(rawBlob) as { state?: { drawer?: unknown } };
      const candidate = parsed?.state?.drawer;
      if (isDrawerShape(candidate)) return candidate;
   } catch {
      // Corrupt blob — fall through to an empty drawer (handled as above).
   }
   return { folders: [], rootItems: [] };
}

/** Maps a nested item to a flat record under `parentFolderId`, preserving its id. */
function toItemRecord(item: DrawerItem, parentFolderId: string, order: number): DrawerItemRecord {
   return {
      id: item.id,
      name: item.name,
      parentFolderId,
      order,
      game: item.game,
      type: item.type,
      content: item.content,
   };
}

/**
 * Flattens a nested drawer into flat folder/item records. Walks `rootItems` and
 * `folders` (recursively) in array order, assigning a contiguous `order`
 * (`0..n-1`) per sibling set and storing the root sentinel for top-level rows.
 * Every existing id is preserved.
 */
function flattenDrawer(drawer: Drawer): { folderRecords: DrawerFolderRecord[]; itemRecords: DrawerItemRecord[] } {
   const folderRecords: DrawerFolderRecord[] = [];
   const itemRecords: DrawerItemRecord[] = [];

   drawer.rootItems.forEach((item, index) => {
      itemRecords.push(toItemRecord(item, DRAWER_ROOT_PARENT_ID, index));
   });

   const walkFolders = (folders: Folder[], parentFolderId: string): void => {
      folders.forEach((folder, folderIndex) => {
         folderRecords.push({ id: folder.id, name: folder.name, parentFolderId, order: folderIndex });
         folder.items.forEach((item, itemIndex) => {
            itemRecords.push(toItemRecord(item, folder.id, itemIndex));
         });
         walkFolders(folder.folders, folder.id);
      });
   };

   walkFolders(drawer.folders, DRAWER_ROOT_PARENT_ID);

   return { folderRecords, itemRecords };
}

/** Writes the fresh-install meta flags (no blob to migrate) in one meta transaction. */
async function markFreshInstall(): Promise<void> {
   await drawerDatabase.transaction('rw', drawerDatabase.meta, async () => {
      await drawerDatabase.meta.bulkPut([
         { key: 'schemaVersion', value: DRAWER_SCHEMA_VERSION },
         { key: 'migrationStatus', value: 'completed' },
      ]);
   });
}

/** The actual migration body. See {@link runDrawerMigrationIfNeeded} for the guarded entry point. */
async function performMigration(): Promise<DrawerMigrationOutcome> {
   // Fast path: already migrated (spec §6.2). The authoritative gate is re-checked
   // inside the write transaction below.
   const status = await drawerDatabase.meta.get('migrationStatus');
   if (status?.value === 'completed') return 'already-completed';

   // Read the legacy blob. A missing blob means a fresh install (spec §6.2).
   let rawBlob: string | null;
   try {
      rawBlob = localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY);
   } catch {
      // localStorage unavailable (e.g. privacy mode): nothing to migrate.
      rawBlob = null;
   }

   if (rawBlob === null) {
      await markFreshInstall();
      return 'fresh-install';
   }

   // Parse + extract + harmonize OUTSIDE the transaction (pure, no DB writes), so
   // the transaction only spans the atomic write.
   const drawer = extractDrawerFromBlob(rawBlob);
   const harmonizedDrawer = harmonizeData(drawer, 'FULL_DRAWER');
   const { folderRecords, itemRecords } = flattenDrawer(harmonizedDrawer);

   // Single atomic rw transaction over folders + items + meta (spec §6.3). On any
   // throw the whole thing rolls back: the flag stays unset and the legacy blob is
   // never touched, so the next load safely retries (spec §6.4).
   await drawerDatabase.transaction('rw', drawerDatabase.folders, drawerDatabase.items, drawerDatabase.meta, async () => {
      // Re-check the gate inside the transaction for concurrent safety.
      const innerStatus = await drawerDatabase.meta.get('migrationStatus');
      if (innerStatus?.value === 'completed') return;

      // Defense in depth (spec §6.4): refuse to write into non-empty stores when
      // the flag is unset, rather than duplicating data.
      const existingFolderCount = await drawerDatabase.folders.count();
      const existingItemCount = await drawerDatabase.items.count();
      if (existingFolderCount > 0 || existingItemCount > 0) {
         throw new DrawerMigrationError(
            'Drawer stores are not empty but the migration flag is unset; aborting to avoid duplicating data.',
         );
      }

      if (folderRecords.length > 0) await drawerDatabase.folders.bulkAdd(folderRecords);
      if (itemRecords.length > 0) await drawerDatabase.items.bulkAdd(itemRecords);

      await drawerDatabase.meta.bulkPut([
         { key: 'schemaVersion', value: DRAWER_SCHEMA_VERSION },
         { key: 'migrationStatus', value: 'completed' },
         // Marker that the legacy blob is intentionally retained as of this
         // version; a later release removes the blob once the new store is proven.
         { key: 'legacyBlobRetainedUntil', value: APP_VERSION },
      ]);
   });

   return 'migrated';
}

/**
 * Migrates the legacy localStorage drawer blob into Dexie exactly once.
 *
 * Idempotent and concurrency-safe: gated on `meta.migrationStatus` (with a
 * re-check and an empty-store assertion inside the write transaction), and
 * de-duplicated across concurrent/StrictMode double invocations via a shared
 * in-flight promise. The whole write is atomic — a failure rolls back, leaves the
 * flag unset and the legacy blob untouched, and is safe to retry on the next
 * load.
 *
 * @returns Which path ran: `'already-completed'`, `'fresh-install'`, or `'migrated'`.
 */
export function runDrawerMigrationIfNeeded(): Promise<DrawerMigrationOutcome> {
   if (!inFlightMigration) {
      inFlightMigration = performMigration().finally(() => {
         inFlightMigration = null;
      });
   }
   return inFlightMigration;
}
