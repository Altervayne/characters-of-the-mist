// -- Type Imports --
import type { DrawerItemContent, GameSystem, GeneralItemType } from '@/lib/types/drawer';

/**
 * Sentinel `parentFolderId` for top-level (root) folders and items.
 *
 * IndexedDB does not index records whose indexed key path evaluates to
 * `null`/`undefined`, so a literal `null` parent would make top-level rows
 * invisible to the `[parentFolderId+order]` index. Every top-level record
 * therefore stores this reserved value instead. The repository translates
 * between this sentinel and the application's `string | null` (where `null`
 * means root) at its boundary, so callers never see the sentinel.
 *
 * The value is reserved: it must never collide with a generated `cuid()`.
 */
export const DRAWER_ROOT_PARENT_ID = 'root';

/**
 * A flat folder record in the normalized drawer store.
 *
 * Replaces the recursive {@link import('@/lib/types/drawer').Folder} shape: a
 * folder no longer embeds its children, it back-references its parent via
 * `parentFolderId` (or {@link DRAWER_ROOT_PARENT_ID} at root) and carries an
 * explicit sibling `order`.
 */
export interface DrawerFolderRecord {
   /** Stable unique identifier (primary key). */
   id: string;
   /** Display name. */
   name: string;
   /** Parent folder id, or {@link DRAWER_ROOT_PARENT_ID} for a top-level folder. */
   parentFolderId: string;
   /** Contiguous position within its sibling folders (`0..n-1`). */
   order: number;
}

/**
 * A flat item record in the normalized drawer store.
 *
 * Mirrors {@link import('@/lib/types/drawer').DrawerItem} but flattened: the item
 * back-references its parent via `parentFolderId` (or {@link DRAWER_ROOT_PARENT_ID}
 * at root) and carries an explicit sibling `order`. The stored `content`
 * (`Card | Tracker | Character`) remains a single serialized value on the record
 * - it is never shredded into separate stores.
 */
export interface DrawerItemRecord {
   /** Stable unique identifier (primary key). */
   id: string;
   /** Display name. */
   name: string;
   /** Parent folder id, or {@link DRAWER_ROOT_PARENT_ID} for a top-level item. */
   parentFolderId: string;
   /** Contiguous position within its sibling items (`0..n-1`). */
   order: number;
   /** Game system the content belongs to (indexed for future filtering). */
   game: GameSystem;
   /** Concrete kind of the stored content (indexed for future filtering). */
   type: GeneralItemType;
   /** The serialized aggregate this item wraps (card, tracker, or character). */
   content: DrawerItemContent;
}

/**
 * A singleton key/value row in the `meta` store.
 *
 * Holds bookkeeping that is not folder/item data:
 * - `schemaVersion` — the persisted Dexie schema version.
 * - `migrationStatus` — the one-time legacy-blob migration status flag.
 * - `legacyBlobRetainedUntil` — marker that the legacy localStorage blob is still
 *   retained as a safety backup (dropped when the blob is finally removed).
 * - `migrationVerified` — `true` once the migration was proven faithful by
 *   reconstructing the Dexie tree at migration time and deep-comparing it to the
 *   source blob. Gates legacy-blob removal; absent ⇒ never offer removal.
 * - `migratedRecordCounts` — `{ folders, items }` written from the same faithful
 *   migration, for diagnostics.
 *
 * Each `key` addresses exactly one row.
 */
export interface DrawerMetaRecord {
   /** The well-known meta key this row stores. */
   key: 'schemaVersion' | 'migrationStatus' | 'legacyBlobRetainedUntil' | 'migrationVerified' | 'migratedRecordCounts';
   /** The stored value for `key`. */
   value: unknown;
}
