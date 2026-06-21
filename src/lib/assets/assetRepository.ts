// -- Library Imports --
import { type Table } from 'dexie';

// -- Local Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { AssetRepositoryError } from './assetErrors';

// -- Type Imports --
import type { AssetRecord } from './assetRecords';
import type { ProcessedImage } from './processImage';

/*
 * Framework-agnostic data-access layer for content-addressed image assets. Pure
 * persistence: no React, no zustand, no toasts, no console. Lives in the same Dexie
 * database as the drawer and characters; nothing outside this module touches
 * `db.assets`. Rows are keyed by `hash` (SHA-256 of the processed webp bytes), so
 * stores are dedup-aware and identical bytes collapse to one row.
 */

/**
 * Runs `work` in a read/write transaction over `tables`. Any failure aborts the
 * transaction (rolling back every write) and is rethrown as an
 * {@link AssetRepositoryError} preserving the original cause.
 */
async function runWriteTransaction<T>(tables: Table[], work: () => Promise<T>): Promise<T> {
   try {
      return await db.transaction('rw', tables, work);
   } catch (error) {
      throw new AssetRepositoryError(
         `Asset write transaction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
         { cause: error },
      );
   }
}

/**
 * Stores a processed image, dedup-aware. If a row with the same `hash` already
 * exists, returns the hash WITHOUT rewriting (content-addressed: identical bytes
 * are an identical row, and the original `createdAt` is preserved). Otherwise
 * inserts a fresh {@link AssetRecord} stamped with `createdAt: Date.now()`.
 *
 * @param processed - The pipeline output to persist.
 * @returns The asset's `hash` (its primary key), existing or newly inserted.
 */
export function storeAsset(processed: ProcessedImage): Promise<string> {
   return runWriteTransaction([db.assets], async () => {
      // Existence check on the primary key only - never loads the (potentially large) blob.
      const alreadyStored = await db.assets.where('hash').equals(processed.hash).count();
      if (alreadyStored > 0) return processed.hash;

      const record: AssetRecord = {
         hash: processed.hash,
         blob: processed.blob,
         mimeType: processed.mimeType,
         width: processed.width,
         height: processed.height,
         byteSize: processed.byteSize,
         createdAt: Date.now(),
      };
      await db.assets.add(record);
      return processed.hash;
   });
}

/** Returns just the stored blob for `hash`, or `undefined` when no such asset exists. */
export async function getAssetBlob(hash: string): Promise<Blob | undefined> {
   const record = await db.assets.get(hash);
   return record?.blob;
}

/**
 * Returns the full stored record for `hash` (blob + metadata), or `undefined` when
 * absent. Used by export embedding, which needs the dimensions alongside the bytes so
 * the import side never has to decode to learn them.
 */
export function getAsset(hash: string): Promise<AssetRecord | undefined> {
   return db.assets.get(hash);
}

/**
 * Lists every asset's `hash` + `createdAt`, never the blobs - the GC's cheap "what
 * exists" side (prompt 2). Reads only the `createdAt` index and the primary keys it
 * traverses, so no row body (and no blob) is deserialized.
 */
export async function listAssetHashes(): Promise<{ hash: string; createdAt: number }[]> {
   const ordered = db.assets.orderBy('createdAt');
   // Both reads traverse the same `createdAt` index in the same order, so element i
   // of each lines up: createdAts[i] belongs to hashes[i].
   const [hashes, createdAts] = await Promise.all([
      ordered.primaryKeys() as Promise<string[]>,
      ordered.keys() as Promise<number[]>,
   ]);
   return hashes.map((hash, index) => ({ hash, createdAt: createdAts[index] }));
}

/**
 * Bulk-deletes assets by hash. Idempotent: hashes with no matching row are no-ops.
 * Used only by the GC sweep (prompt 2).
 */
export function deleteAssets(hashes: string[]): Promise<void> {
   return runWriteTransaction([db.assets], async () => {
      await db.assets.bulkDelete(hashes);
   });
}

/**
 * Sums the `byteSize` of the given assets, for reporting how much a sweep reclaimed.
 * Reads the candidate rows directly (the sweep calls this only for the small set it
 * is about to delete); absent hashes contribute nothing.
 */
export async function getAssetByteSizes(hashes: string[]): Promise<number> {
   if (hashes.length === 0) return 0;
   const rows = await db.assets.bulkGet(hashes);
   return rows.reduce((total, row) => total + (row?.byteSize ?? 0), 0);
}

/** Deletes all asset rows (powers "Reset app"), mirroring `clearAllCharacterData`. */
export function clearAllAssets(): Promise<void> {
   return runWriteTransaction([db.assets], async () => {
      await db.assets.clear();
   });
}

/** Bookkeeping written after each garbage-collection sweep; gates the periodic check. */
export interface AssetSweepRecord {
   /** Epoch ms the sweep ran. */
   at: number;
   /** Asset count remaining after the sweep; the periodic gate compares the live count against this. */
   assetCount: number;
   /** What triggered the sweep, for debugging. */
   reason: 'startup' | 'manual' | 'periodic';
}

/** Reads the last sweep bookkeeping from the `meta` store, or `undefined` if never swept. */
export async function readLastSweep(): Promise<AssetSweepRecord | undefined> {
   const row = await db.meta.get('assetsLastSwept');
   return row?.value as AssetSweepRecord | undefined;
}

/** Records the outcome of a sweep in the `meta` store, for the periodic pressure gate. */
export async function writeLastSweep(record: AssetSweepRecord): Promise<void> {
   await db.meta.put({ key: 'assetsLastSwept', value: record });
}
