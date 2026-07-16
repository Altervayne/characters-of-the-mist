// -- React Imports --
import { useEffect, useState } from 'react';

// -- Store Imports --
import { getAssetBlob } from '@/lib/assets/assetRepository';

// -- Demo Portrait Seam --
import { DEMO_PORTRAIT_ASSET_ID } from '@/lib/tutorial/demo/demoSentinels';
import { DEMO_PORTRAIT_URL } from '@/lib/tutorial/demo/demoPortrait';

/*
 * Resolves a stored asset hash to a temporary object URL for an <img>. An asset hash is
 * content-addressed and immutable, so its object URL is stable: it lives in a shared,
 * ref-counted cache keyed by hash, NOT tied to one component mount. A remount (e.g. a board
 * item re-mounting when it is selected) reuses the cached URL synchronously - no revoke, no
 * reload, no flicker. The URL is revoked only after its LAST consumer unmounts plus a short
 * grace, so a quick remount within the grace keeps it alive while a genuinely-gone image is
 * still cleaned up. A null hash is the empty state, not a load. A hash whose blob is missing
 * settles (and caches) a null URL - an empty frame, not a perpetual spinner. A load for a
 * stale hash never overwrites a newer one: each consumer's resolve is per-hash and guarded.
 */

interface AssetObjectUrl {
   /** The object URL for the asset, or `null` when there is none (empty, loading, or missing blob). */
   url: string | null;
   /** True while the blob for a non-null hash is still being read (only on its FIRST, uncached load). */
   isLoading: boolean;
}

/** A cached entry for one hash: its settled URL plus how many live consumers hold it. */
interface CacheEntry {
   /** The object URL once settled, or `null` for a missing blob. */
   url: string | null;
   /** Whether the blob load has settled (so a peek can serve the URL synchronously). */
   settled: boolean;
   /** Live consumers holding this hash; at 0 the entry is scheduled for revoke. */
   refCount: number;
   /** The one in-flight load, shared by every consumer that mounts before it settles. */
   loading?: Promise<void>;
   /** A pending grace-period revoke, cancelled if the hash is re-acquired in time. */
   revokeTimer?: ReturnType<typeof setTimeout>;
   /** Set once the grace revoke has fired, so a late load discards its fresh URL instead of leaking it. */
   disposed?: boolean;
}

/** How long a hash's URL is kept after its last consumer leaves, so a quick remount reuses it. */
export const ASSET_URL_GRACE_MS = 5000;

const cache = new Map<string, CacheEntry>();

/**
 * Claims the cached URL for `hash`, loading the blob once on the first claim. Bumps the ref
 * count and cancels any pending revoke, so a remount within the grace reuses the URL with no
 * reload. The returned entry is settled synchronously on a cache hit.
 */
export function acquireAssetUrl(hash: string): CacheEntry {
   const existing = cache.get(hash);
   if (existing) {
      existing.refCount++;
      if (existing.revokeTimer !== undefined) {
         clearTimeout(existing.revokeTimer);
         existing.revokeTimer = undefined;
      }
      return existing;
   }

   const entry: CacheEntry = { url: null, settled: false, refCount: 1 };
   cache.set(hash, entry);
   entry.loading = getAssetBlob(hash)
      .then((blob) => {
         const url = blob ? URL.createObjectURL(blob) : null;
         // The last consumer may have left (and the entry been revoked) mid-load: drop this URL.
         if (entry.disposed) {
            if (url) URL.revokeObjectURL(url);
            return;
         }
         entry.url = url;
         entry.settled = true;
      })
      .catch(() => {
         if (!entry.disposed) entry.settled = true; // a failed read settles to an empty frame
      });
   return entry;
}

/**
 * Releases one consumer's claim on `hash`. When the last consumer leaves, schedules a
 * grace-period revoke; a re-acquire within the grace cancels it.
 */
export function releaseAssetUrl(hash: string): void {
   const entry = cache.get(hash);
   if (!entry) return;
   entry.refCount--;
   if (entry.refCount > 0 || entry.revokeTimer !== undefined) return;

   entry.revokeTimer = setTimeout(() => {
      entry.disposed = true;
      cache.delete(hash);
      if (entry.url) URL.revokeObjectURL(entry.url);
   }, ASSET_URL_GRACE_MS);
}

/** Reads `hash`'s settled state without claiming it, so a remount paints the URL on its first render. */
function peekAssetUrl(hash: string | null): AssetObjectUrl {
   if (!hash) return { url: null, isLoading: false };
   const entry = cache.get(hash);
   if (entry?.settled) return { url: entry.url, isLoading: false };
   return { url: null, isLoading: true };
}

/**
 * Loads the blob for `hash` and exposes it as an object URL, backed by the shared cache.
 *
 * @param hash - The asset hash, or `null` for the empty state.
 * @returns The object URL and a loading flag.
 */
export function useAssetObjectUrl(hash: string | null): AssetObjectUrl {
   // The value is DERIVED from the cache each render (below), so a settled hash paints instantly
   // - on first mount, on a remount, and on a hash change - with no synchronous state writes. This
   // bump only forces a re-render once an uncached load settles.
   const [, bump] = useState(0);

   useEffect(() => {
      // The demo portrait resolves to a bundled placeholder with no store access, so nothing to acquire.
      if (!hash || hash === DEMO_PORTRAIT_ASSET_ID) return;

      let cancelled = false;
      const entry = acquireAssetUrl(hash);
      // Per-hash + cancelled-guarded: a stale resolve can never paint over a newer hash.
      if (!entry.settled) {
         void entry.loading?.then(() => {
            if (!cancelled) bump((n) => n + 1);
         });
      }

      return () => {
         cancelled = true;
         releaseAssetUrl(hash);
      };
   }, [hash]);

   // The demo portrait short-circuits the whole asset-store path: a bundled URL, never a Dexie read.
   if (hash === DEMO_PORTRAIT_ASSET_ID) return { url: DEMO_PORTRAIT_URL, isLoading: false };

   return peekAssetUrl(hash);
}
