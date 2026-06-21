// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import * as repository from './assetRepository';

// -- Type Imports --
import type { ProcessedImage } from './processImage';

/*
 * Unit tests for the asset repository against fake-indexeddb. Covers dedup-aware
 * store, blob get, the light hash+createdAt listing, bulk delete, and clear.
 *
 * These use small synthetic ProcessedImage objects carrying a tiny real Blob: the
 * decode/scale/encode pipeline in `processImage` depends on `createImageBitmap` and
 * a canvas, which the test runner does not provide, so it is verified in-browser
 * when the consumer lands. Only its hashing step is unit-tested (see
 * `processImage.test.ts`); here we feed the repository hashes we control.
 */

/** Builds a synthetic processed image with a tiny real webp blob and a caller-set hash. */
function makeProcessed(hash: string, overrides: Partial<ProcessedImage> = {}): ProcessedImage {
   const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' });
   return {
      hash,
      blob,
      mimeType: 'image/webp',
      width: 64,
      height: 48,
      byteSize: blob.size,
      ...overrides,
   };
}

beforeEach(async () => {
   await drawerDatabase.assets.clear();
});

describe('asset repository', () => {
   it('stores a processed image and returns its hash, retrievable as a blob', async () => {
      const hash = await repository.storeAsset(makeProcessed('hash-a'));

      expect(hash).toBe('hash-a');
      const blob = await repository.getAssetBlob('hash-a');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob?.type).toBe('image/webp');
      expect(blob?.size).toBe(4);
   });

   it('getAssetBlob returns undefined for a missing hash', async () => {
      expect(await repository.getAssetBlob('nope')).toBeUndefined();
   });

   it('is dedup-aware: a second store with an existing hash does not rewrite the row', async () => {
      await repository.storeAsset(makeProcessed('hash-a', { width: 64 }));
      const firstRow = await drawerDatabase.assets.get('hash-a');

      await new Promise((resolve) => setTimeout(resolve, 3)); // would-be-later timestamp
      // Same hash, different metadata: a rewrite would change width/createdAt.
      const returned = await repository.storeAsset(makeProcessed('hash-a', { width: 999 }));

      expect(returned).toBe('hash-a');
      expect(await drawerDatabase.assets.count()).toBe(1);
      const afterRow = await drawerDatabase.assets.get('hash-a');
      expect(afterRow?.width).toBe(64); // original metadata preserved, not overwritten
      expect(afterRow?.createdAt).toBe(firstRow?.createdAt); // createdAt unchanged
   });

   it('stamps createdAt on a fresh insert', async () => {
      await repository.storeAsset(makeProcessed('hash-a'));
      const row = await drawerDatabase.assets.get('hash-a');
      expect(typeof row?.createdAt).toBe('number');
   });

   it('lists hashes + createdAt (ordered, no blobs)', async () => {
      await repository.storeAsset(makeProcessed('hash-1'));
      await new Promise((resolve) => setTimeout(resolve, 3));
      await repository.storeAsset(makeProcessed('hash-2'));

      const listed = await repository.listAssetHashes();

      expect(listed.map((entry) => entry.hash)).toEqual(['hash-1', 'hash-2']); // createdAt-ascending
      for (const entry of listed) {
         expect(typeof entry.createdAt).toBe('number');
         expect(entry).not.toHaveProperty('blob'); // the blobs are never loaded
         expect(Object.keys(entry).sort()).toEqual(['createdAt', 'hash']);
      }
   });

   it('bulk-deletes assets and is idempotent for absent hashes', async () => {
      await repository.storeAsset(makeProcessed('hash-1'));
      await repository.storeAsset(makeProcessed('hash-2'));
      await repository.storeAsset(makeProcessed('hash-3'));

      await repository.deleteAssets(['hash-1', 'hash-missing', 'hash-3']);

      expect((await repository.listAssetHashes()).map((entry) => entry.hash)).toEqual(['hash-2']);
      await repository.deleteAssets(['hash-1']); // already gone -> no throw
   });

   it('clearAllAssets removes every asset row', async () => {
      await repository.storeAsset(makeProcessed('hash-1'));
      await repository.storeAsset(makeProcessed('hash-2'));

      await repository.clearAllAssets();

      expect(await drawerDatabase.assets.count()).toBe(0);
   });
});
