// -- Utils Imports --
import { harmonizeData } from '@/lib/harmonization';
import { APP_VERSION } from '@/lib/config';

// -- Local Imports --
import { drawerDatabase } from './drawerDatabase';
import { DRAWER_ROOT_PARENT_ID } from './drawerRecords';
import { exportEntireDrawerAsNestedTree } from './drawerRepository';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord } from './drawerRecords';
import type { Drawer, DrawerItem, Folder } from '@/lib/types/drawer';

/*
 * One-time migration of the legacy localStorage drawer blob into the Dexie stores.
 * Additive: the app keeps reading the old store; this only writes the Dexie copy and
 * guards itself so it runs exactly once. Ids are preserved (keeping `drawerItemId`
 * links intact) and the legacy key is retained for now (removed in a later release).
 */

/**
 * localStorage key of the legacy zustand-persist drawer blob (shape
 * `{ state: { drawer }, version }`). Exported so the later removal step has a
 * single source of truth. NOT the `characterData` key (LegacyDataDialog) nor the
 * character-file import feature (MigrationDialog); those are unrelated.
 *
 * TODO (a LATER release, NOT now): once the Dexie drawer is proven in the field,
 * remove this blob with
 * `localStorage.removeItem(LEGACY_DRAWER_STORAGE_KEY)` (e.g. in a new bootstrap
 * step gated on `meta.legacyBlobRetainedUntil`) and drop the
 * `legacyBlobRetainedUntil` marker. It is intentionally RETAINED for now as a
 * read-only safety net; the migration is idempotent and never re-imports it once
 * `meta.migrationStatus === 'completed'`.
 */
export const LEGACY_DRAWER_STORAGE_KEY = 'characters-of-the-mist_drawer-storage';

/**
 * The drawer's own schema version, written to `meta.schemaVersion`. Tracks the
 * Dexie `version(1)` declared in `drawerDatabase.ts`; the drawer no longer rides
 * on the shared `STORE_VERSION`.
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
      // Corrupt blob: fall through to an empty drawer.
   }
   return { folders: [], rootItems: [] };
}

/**
 * Maps a nested item to a flat record under `parentFolderId`, preserving its id. Every migrated item
 * is stamped with the single `migratedAt` (its real history is unguessable), so post-migration the
 * write path takes over with real per-edit dates.
 */
function toItemRecord(item: DrawerItem, parentFolderId: string, order: number, migratedAt: number): DrawerItemRecord {
   return {
      id: item.id,
      name: item.name,
      parentFolderId,
      order,
      game: item.game,
      type: item.type,
      createdAt: migratedAt,
      updatedAt: migratedAt,
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
   // One timestamp per migration run: history is unguessable, so every migrated item shares it.
   const migratedAt = Date.now();

   drawer.rootItems.forEach((item, index) => {
      itemRecords.push(toItemRecord(item, DRAWER_ROOT_PARENT_ID, index, migratedAt));
   });

   const walkFolders = (folders: Folder[], parentFolderId: string): void => {
      folders.forEach((folder, folderIndex) => {
         folderRecords.push({ id: folder.id, name: folder.name, parentFolderId, order: folderIndex });
         folder.items.forEach((item, itemIndex) => {
            itemRecords.push(toItemRecord(item, folder.id, itemIndex, migratedAt));
         });
         walkFolders(folder.folders, folder.id);
      });
   };

   walkFolders(drawer.folders, DRAWER_ROOT_PARENT_ID);

   return { folderRecords, itemRecords };
}

/** Recursive structural equality: key-order-insensitive for objects, order-sensitive for arrays. */
function deepEqual(a: unknown, b: unknown): boolean {
   if (a === b) return true;
   if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;

   const aIsArray = Array.isArray(a);
   const bIsArray = Array.isArray(b);
   if (aIsArray !== bIsArray) return false;
   if (aIsArray && bIsArray) {
      if (a.length !== b.length) return false;
      return a.every((element, index) => deepEqual(element, b[index]));
   }

   const aObj = a as Record<string, unknown>;
   const bObj = b as Record<string, unknown>;
   const aKeys = Object.keys(aObj);
   const bKeys = Object.keys(bObj);
   if (aKeys.length !== bKeys.length) return false;
   return aKeys.every((key) => Object.prototype.hasOwnProperty.call(bObj, key) && deepEqual(aObj[key], bObj[key]));
}

/**
 * Deep-compares the migratable contents of two drawers - their `folders` and
 * `rootItems` trees (ids, structure, content). The drawer-level `version` field is
 * intentionally ignored: the tree reconstructed by `exportEntireDrawerAsNestedTree`
 * carries no top-level version, while the harmonized source may.
 */
function nestedDrawerContentsEqual(source: Drawer, reconstructed: Drawer): boolean {
   return deepEqual(source.folders, reconstructed.folders) && deepEqual(source.rootItems, reconstructed.rootItems);
}

/** Strictly parses a legacy blob string, distinguishing a corrupt blob from a valid one. */
type LegacyBlobParse = { ok: true; drawer: Drawer } | { ok: false };
function parseLegacyBlobStrict(rawBlob: string): LegacyBlobParse {
   try {
      const parsed = JSON.parse(rawBlob) as { state?: { drawer?: unknown } };
      const candidate = parsed?.state?.drawer;
      if (isDrawerShape(candidate)) return { ok: true, drawer: candidate };
   } catch {
      // fall through to the failure result
   }
   return { ok: false };
}

/** Whether the legacy blob is still present in localStorage (read-safe). */
function isLegacyBlobPresent(): boolean {
   try {
      return localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY) !== null;
   } catch {
      return false;
   }
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
   // Fast path: already migrated. The authoritative gate is re-checked
   // inside the write transaction below.
   const status = await drawerDatabase.meta.get('migrationStatus');
   if (status?.value === 'completed') return 'already-completed';

   // Read the legacy blob. A missing blob means a fresh install.
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

   // Single atomic rw transaction over folders + items + meta. On any throw the whole
   // thing rolls back: the flag stays unset and the legacy blob is never touched, so
   // the next load safely retries.
   await drawerDatabase.transaction('rw', drawerDatabase.folders, drawerDatabase.items, drawerDatabase.meta, async () => {
      // Re-check the gate inside the transaction for concurrent safety.
      const innerStatus = await drawerDatabase.meta.get('migrationStatus');
      if (innerStatus?.value === 'completed') return;

      // Defense in depth: refuse to write into non-empty stores when
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

   // Verify faithfulness NOW, the one moment Dexie is guaranteed to equal the
   // source: reconstruct the nested tree from Dexie and deep-compare it to the
   // harmonized source blob (structure + content + ids). Record `migrationVerified`
   // ONLY on an exact match - it is the sole gate for ever removing the legacy
   // blob. On mismatch, leave the flag unset and fail closed by throwing: the data
   // is migrated and usable, but the blob is then retained indefinitely (removal is
   // never offered without the flag).
   const reconstructedDrawer = await exportEntireDrawerAsNestedTree();
   if (!nestedDrawerContentsEqual(harmonizedDrawer, reconstructedDrawer)) {
      throw new DrawerMigrationError(
         'Migration verification failed: the reconstructed Dexie tree does not match the source blob; the legacy blob will be retained.',
      );
   }
   await drawerDatabase.meta.bulkPut([
      { key: 'migrationVerified', value: true },
      { key: 'migratedRecordCounts', value: { folders: folderRecords.length, items: itemRecords.length } },
   ]);

   return 'migrated';
}

/**
 * Migrates the legacy localStorage drawer blob into Dexie exactly once.
 *
 * Idempotent and concurrency-safe: gated on `meta.migrationStatus` (with a
 * re-check and an empty-store assertion inside the write transaction), and
 * de-duplicated across concurrent/StrictMode double invocations via a shared
 * in-flight promise. The whole write is atomic: a failure rolls back, leaves the
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

// ==================
//  Legacy-blob retirement (user-data-safe, user-initiated)
// ==================
// The legacy blob is removed ONLY via an explicit settings action, gated on the
// migration-time `migrationVerified` flag plus a user-completed backup export plus
// an explicit confirmation. There is no automatic removal and no post-hoc
// live-Dexie-vs-blob comparison (Dexie legitimately diverges through normal use).

/**
 * Whether the legacy localStorage blob may be offered for removal.
 *
 * Removable ONLY when the blob is still present, the migration completed, AND it
 * was proven faithful at migration time (`meta.migrationVerified === true`).
 * Anything else - no blob, unverified, or an early migration predating the
 * verification flag - yields `removable: false`, so the blob is kept (fail-safe).
 *
 * @returns `blobPresent` (is there anything to remove) and `removable` (is it safe
 *   to offer removal).
 */
export async function getLegacyBlobRemovalState(): Promise<{ removable: boolean; blobPresent: boolean }> {
   const blobPresent = isLegacyBlobPresent();
   if (!blobPresent) return { removable: false, blobPresent: false };

   const status = await drawerDatabase.meta.get('migrationStatus');
   const verified = await drawerDatabase.meta.get('migrationVerified');
   return { removable: status?.value === 'completed' && verified?.value === true, blobPresent: true };
}

/**
 * Parses the legacy blob into a harmonized {@link Drawer} for a safety-backup
 * export. Returns `null` when the blob is absent or unparseable (so the caller
 * fails closed and never deletes without a real backup). Does NOT delete anything.
 */
export function getLegacyDrawerForBackup(): Drawer | null {
   let rawBlob: string | null;
   try {
      rawBlob = localStorage.getItem(LEGACY_DRAWER_STORAGE_KEY);
   } catch {
      return null;
   }
   if (rawBlob === null) return null;

   const parsed = parseLegacyBlobStrict(rawBlob);
   if (!parsed.ok) return null;
   return harmonizeData(parsed.drawer, 'FULL_DRAWER');
}

/**
 * Removes the legacy localStorage blob and drops the `legacyBlobRetainedUntil`
 * marker. The caller MUST have gated this on {@link getLegacyBlobRemovalState}
 * being removable, an explicit user confirmation, and a completed backup export.
 * Idempotent: `removeItem` on an absent key is a no-op.
 */
export async function removeLegacyDrawerBlob(): Promise<void> {
   try {
      localStorage.removeItem(LEGACY_DRAWER_STORAGE_KEY);
   } catch {
      // localStorage unavailable: nothing to remove.
   }
   await drawerDatabase.meta.delete('legacyBlobRetainedUntil');
}
