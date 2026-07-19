// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { APP_VERSION } from '@/lib/config';
import { blobToBase64, downloadTextFile, rehydrateEmbeddedAssets, type EmbeddedAsset } from '@/lib/utils/export-import';
import { WORKSPACE_KEY } from '@/lib/character/workspaceSession';
import { APP_SETTINGS_STORAGE_KEY } from '@/lib/stores/appSettingsStore';
import { RECENT_COLORS_KEY } from '@/lib/recentColors';

// -- Type Imports --
import type { AssetRecord } from '@/lib/assets/assetRecords';

/*
 * Full app backup: one self-contained file capturing the ENTIRE app state, and the restore that
 * replaces everything with it. Distinct from the per-entity `.cotm` export/import (which re-IDs and
 * merges) - a backup carries verbatim ids so every cross-table reference survives a restore-to-fresh-device.
 *
 * Completeness rule: every Dexie store is captured by iterating the live table set, so a future store
 * is backed up automatically without touching this file. `meta` is the one exclusion - it holds
 * migration bookkeeping that is origin-specific and wrong on a restored device. localStorage is a fixed
 * closed set of durable keys (app settings incl. custom themes, the open-tabs workspace, recent colors,
 * and the chosen language); everything else there is legacy or derived.
 */

/** Migration bookkeeping store - origin-specific, never backed up or cleared by a restore. */
const META_TABLE = 'meta';

/** The store whose rows hold native `Blob`s; base64'd on the way out, rehydrated (and re-hashed) on the way in. */
const ASSETS_TABLE = 'assets';

/** The i18next language-detector localStorage key (its default cache key). */
const I18N_LANGUAGE_KEY = 'i18nextLng';

/** The durable localStorage keys a backup captures verbatim (a closed set; legacy/derived keys are excluded). */
export const BACKUP_LOCAL_STORAGE_KEYS: readonly string[] = [
   APP_SETTINGS_STORAGE_KEY,
   WORKSPACE_KEY,
   RECENT_COLORS_KEY,
   I18N_LANGUAGE_KEY,
];

/** The backup envelope discriminant - deliberately distinct from any `.cotm` `fileType`. */
export const FULL_BACKUP_FILE_TYPE = 'FULL_BACKUP';

/** The backup file extension - distinct from `.cotm` so a full-replace backup can never be drag-drop imported. */
export const BACKUP_EXTENSION = 'cotmbak';

/** An `assets` row serialized for the file: the record minus its blob, plus the blob's bytes as base64. */
interface EmbeddedBackupAsset {
   hash: string;
   mimeType: string;
   width: number;
   height: number;
   byteSize: number;
   createdAt: number;
   base64: string;
}

/** The full-backup file envelope. `indexeddb` is keyed by store name; asset rows carry their blob as base64. */
export interface FullBackupFile {
   fileType: typeof FULL_BACKUP_FILE_TYPE;
   app: 'campaigns-of-the-mist';
   version: string;
   createdAt: string;
   indexeddb: Record<string, unknown[]>;
   localStorage: Record<string, string>;
}

/** Serializes an asset row for the file, replacing its blob with base64 bytes and keeping the rest verbatim. */
async function assetRowToEmbedded(record: AssetRecord): Promise<EmbeddedBackupAsset> {
   const { blob, hash, mimeType, width, height, byteSize, createdAt } = record;
   return { hash, mimeType, width, height, byteSize, createdAt, base64: await blobToBase64(blob) };
}

/** Rebuilds the `Record<hash, EmbeddedAsset>` shape the rehydrate path expects from the backup's asset rows. */
function toEmbeddedAssetMap(rows: EmbeddedBackupAsset[]): Record<string, EmbeddedAsset> {
   const map: Record<string, EmbeddedAsset> = {};
   for (const row of rows) {
      map[row.hash] = { mimeType: row.mimeType, width: row.width, height: row.height, base64: row.base64 };
   }
   return map;
}

/**
 * Reads the entire app state into a backup envelope: every non-`meta` Dexie store (assets base64'd) plus the
 * durable localStorage keys, stamped with the app version and a timestamp. Read-only - it never mutates.
 */
export async function buildFullBackup(): Promise<FullBackupFile> {
   const indexeddb: Record<string, unknown[]> = {};

   for (const table of drawerDatabase.tables) {
      if (table.name === META_TABLE) continue;
      const rows = await table.toArray();
      indexeddb[table.name] = table.name === ASSETS_TABLE
         ? await Promise.all((rows as AssetRecord[]).map(assetRowToEmbedded))
         : rows;
   }

   const localStorageSnapshot: Record<string, string> = {};
   for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) localStorageSnapshot[key] = value;
   }

   return {
      fileType: FULL_BACKUP_FILE_TYPE,
      app: 'campaigns-of-the-mist',
      version: APP_VERSION,
      createdAt: new Date().toISOString(),
      indexeddb,
      localStorage: localStorageSnapshot,
   };
}

/** Builds the backup and triggers a browser download as `campaigns-of-the-mist-backup-<date>.cotmbak`. */
export async function exportFullBackup(): Promise<void> {
   const backup = await buildFullBackup();
   const date = new Date().toISOString().slice(0, 10);
   const fileName = `campaigns-of-the-mist-backup-${date}.${BACKUP_EXTENSION}`;
   downloadTextFile(fileName, JSON.stringify(backup), 'application/json');
}

/** Parses backup text, throwing if it is not a valid full-backup envelope. */
export function parseFullBackup(text: string): FullBackupFile {
   const parsed = JSON.parse(text) as Partial<FullBackupFile>;
   if (parsed.fileType !== FULL_BACKUP_FILE_TYPE || !parsed.indexeddb || !parsed.localStorage) {
      throw new Error('Not a valid Campaigns of the Mist backup file.');
   }
   return parsed as FullBackupFile;
}

/**
 * REPLACES all app data with the backup: clears every non-`meta` store and restores each verbatim (ids
 * preserved, so every cross-table reference holds), assets last through the re-hash rehydrate path, then
 * rewrites the durable localStorage keys - Dexie first, so boot reads a workspace whose rows already exist.
 * The caller reloads afterwards; live zustand stores are not hot-swapped. Operates on the open singleton
 * connection (clear + bulkAdd), never a delete-and-reopen.
 */
export async function applyFullBackup(backup: FullBackupFile): Promise<void> {
   const targetTables = drawerDatabase.tables.filter((table) => table.name !== META_TABLE);
   const nonAssetTables = targetTables.filter((table) => table.name !== ASSETS_TABLE);

   // Clear everything and restore the non-asset stores in one transaction; assets restore after (their
   // rehydrate path opens its own write transactions).
   await drawerDatabase.transaction('rw', targetTables, async () => {
      for (const table of targetTables) await table.clear();
      for (const table of nonAssetTables) {
         const rows = backup.indexeddb[table.name];
         if (rows && rows.length > 0) await table.bulkAdd(rows);
      }
   });

   const assetRows = (backup.indexeddb[ASSETS_TABLE] ?? []) as EmbeddedBackupAsset[];
   if (assetRows.length > 0) await rehydrateEmbeddedAssets(toEmbeddedAssetMap(assetRows));

   for (const key of BACKUP_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
   for (const [key, value] of Object.entries(backup.localStorage)) localStorage.setItem(key, value);
}
