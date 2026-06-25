// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// -- Local Imports --
import { ASSET_URL_GRACE_MS, acquireAssetUrl, releaseAssetUrl } from './useAssetObjectUrl';

// The repository is mocked so the cache can be exercised without Dexie/IndexedDB.
vi.mock('@/lib/assets/assetRepository', () => ({ getAssetBlob: vi.fn() }));
import { getAssetBlob } from '@/lib/assets/assetRepository';

/*
 * Tests for the shared, ref-counted object-URL cache behind useAssetObjectUrl. The point is
 * that a remount reuses the URL (no reload), and the URL is revoked only after the last
 * consumer leaves plus the grace. The React wiring (mount/unmount/seed) rides this cache.
 */

const getBlob = vi.mocked(getAssetBlob);
let nextUrl = 0;

beforeEach(() => {
   getBlob.mockReset();
   nextUrl = 0;
   // Node has no blob-URL methods; stub them so createObjectURL hands back a unique, countable id.
   URL.createObjectURL = vi.fn(() => `blob:mock-${++nextUrl}`) as unknown as typeof URL.createObjectURL;
   URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
   vi.useRealTimers();
});

describe('useAssetObjectUrl cache (acquire / release)', () => {
   it('loads a hash once and serves later consumers the same URL synchronously', async () => {
      getBlob.mockResolvedValue(new Blob(['x']));

      const first = acquireAssetUrl('h-shared');
      expect(first.settled).toBe(false); // first claim loads
      await first.loading;
      expect(first.settled).toBe(true);
      expect(first.url).toBe('blob:mock-1');
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

      // A second consumer (e.g. a remount) gets the URL synchronously, with NO second load.
      const second = acquireAssetUrl('h-shared');
      expect(second).toBe(first);
      expect(second.settled).toBe(true);
      expect(second.url).toBe('blob:mock-1');
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(getBlob).toHaveBeenCalledTimes(1);
   });

   it('revokes only after the LAST consumer leaves plus the grace', async () => {
      getBlob.mockResolvedValue(new Blob(['x']));
      const entry = acquireAssetUrl('h-revoke');
      await entry.loading;
      acquireAssetUrl('h-revoke'); // a second consumer: refCount 2

      vi.useFakeTimers();
      releaseAssetUrl('h-revoke'); // back to one consumer: no revoke scheduled
      vi.advanceTimersByTime(ASSET_URL_GRACE_MS + 100);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();

      releaseAssetUrl('h-revoke'); // last consumer leaves: schedule the grace revoke
      vi.advanceTimersByTime(ASSET_URL_GRACE_MS - 1);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled(); // still within grace
      vi.advanceTimersByTime(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
   });

   it('a remount within the grace cancels the pending revoke (URL kept alive)', async () => {
      getBlob.mockResolvedValue(new Blob(['x']));
      const entry = acquireAssetUrl('h-grace');
      await entry.loading;

      vi.useFakeTimers();
      releaseAssetUrl('h-grace'); // schedule revoke
      vi.advanceTimersByTime(ASSET_URL_GRACE_MS - 1);
      const reacquired = acquireAssetUrl('h-grace'); // remount just in time
      expect(reacquired.url).toBe('blob:mock-1'); // same URL, no reload
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(ASSET_URL_GRACE_MS); // the original timer's window passes
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
   });

   it('caches a missing blob as a null URL (empty frame), with no object URL created', async () => {
      getBlob.mockResolvedValue(undefined);
      const entry = acquireAssetUrl('h-missing');
      await entry.loading;
      expect(entry.settled).toBe(true);
      expect(entry.url).toBeNull();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
   });
});
