// -- React Imports --
import { useEffect, useState } from 'react';

// -- Store Imports --
import { getAssetBlob } from '@/lib/assets/assetRepository';

/*
 * Resolves a stored asset hash to a temporary object URL for an <img>, and owns its
 * lifecycle: the URL is revoked when the hash changes or the component unmounts, and
 * a resolve for a stale hash is discarded so a slow load can never overwrite a newer
 * one. A null hash is the empty state, not a load. A hash whose blob is missing
 * (e.g. a reference imported cross-device before its bytes land) settles to an empty
 * frame rather than a perpetual spinner.
 */

interface AssetObjectUrl {
   /** The object URL for the asset, or `null` when there is none (empty, loading, or missing blob). */
   url: string | null;
   /** True while the blob for a non-null hash is still being read. */
   isLoading: boolean;
}

/** The settled outcome for one hash: its object URL, or `null` when the blob was absent. */
interface ResolvedAsset {
   hash: string;
   url: string | null;
}

/**
 * Loads the blob for `hash` and exposes it as an object URL.
 *
 * @param hash - The asset hash, or `null` for the empty state.
 * @returns The object URL and a loading flag.
 */
export function useAssetObjectUrl(hash: string | null): AssetObjectUrl {
   // State is set only from the async resolve (never synchronously in the effect), so
   // the loading flag is derived: a hash is loading until its own resolve has settled.
   const [resolved, setResolved] = useState<ResolvedAsset | null>(null);

   useEffect(() => {
      if (!hash) return;

      let cancelled = false;
      let objectUrl: string | null = null;

      void getAssetBlob(hash)
         .then((blob) => {
            if (cancelled) return; // hash changed mid-load; ignore this stale resolve
            objectUrl = blob ? URL.createObjectURL(blob) : null;
            setResolved({ hash, url: objectUrl });
         })
         .catch(() => {
            if (!cancelled) setResolved({ hash, url: null });
         });

      return () => {
         cancelled = true;
         if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
   }, [hash]);

   const settledForHash = hash !== null && resolved?.hash === hash;
   return {
      url: settledForHash ? resolved!.url : null,
      isLoading: hash !== null && !settledForHash,
   };
}
