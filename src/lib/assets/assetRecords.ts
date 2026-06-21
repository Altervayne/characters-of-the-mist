/**
 * One row per stored image asset in the `assets` store (Dexie `version(3)`).
 *
 * Assets are CONTENT-ADDRESSED: the primary key `hash` is the SHA-256 of the
 * processed webp bytes, so identical images collapse to one row and a store is a
 * dedup-aware no-op when the hash already exists. The processed `blob` is stored
 * natively (structured-clone), matching the drawer's content-as-blob granularity.
 *
 * There is deliberately NO per-record schema version (unlike `CharacterRecord`):
 * a row is an immutable content-addressed blob plus its derived metadata, so its
 * shape cannot meaningfully migrate - a different processing produces different
 * bytes, hence a different hash and a different row.
 */
export interface AssetRecord {
   /** Primary key: SHA-256 of the PROCESSED webp bytes, as a hex string. */
   hash: string;
   /** The processed webp bytes, stored natively. */
   blob: Blob;
   /** Always `'image/webp'` (the pipeline's single output format). */
   mimeType: string;
   /** Processed width in pixels. */
   width: number;
   /** Processed height in pixels. */
   height: number;
   /** `blob.size`, denormalized for cheap footprint math without loading the blob. */
   byteSize: number;
   /** Epoch milliseconds the row was first stored; powers the GC grace window (prompt 2). */
   createdAt: number;
}
