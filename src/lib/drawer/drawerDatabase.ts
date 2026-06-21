// -- Library Imports --
import { Dexie, type EntityTable } from 'dexie';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord, DrawerMetaRecord } from './drawerRecords';
import type { CharacterRecord } from '@/lib/character/characterRecords';
import type { AssetRecord } from '@/lib/assets/assetRecords';

/**
 * The Dexie database for the normalized drawer.
 *
 * Three object stores:
 * - `folders`: flat folder records, keyed by `id`. Indexed on `parentFolderId`
 *   and the compound `[parentFolderId+order]` (the workhorse for "ordered
 *   children of folder X").
 * - `items`: flat item records, keyed by `id`. Same parent/order indexes, plus
 *   `game` and `type` to pre-empt future filtering/search.
 * - `meta`: singleton key/value bookkeeping (schema version, migration flags),
 *   keyed by `key`.
 * - `characters`: one row per character, the full character stored inline
 *   (added in `version(2)`).
 * - `assets`: one row per content-addressed image, keyed by `hash` (the SHA-256
 *   of the processed webp), indexed on `createdAt` for the GC grace window; the
 *   blob and metadata are stored inline (added in `version(3)`).
 *
 * Despite the database name, it holds both the drawer and the character domains:
 * keeping them in one database lets a save-character-to-drawer update both the
 * `characters` row and the linked drawer `items` row in a single transaction.
 *
 * Only indexed properties are declared in the schema string; non-indexed columns
 * such as `name` and `content` are stored but not listed. Schema changes going
 * forward are made via additional `version(n)` declarations rather than blob
 * re-harmonization.
 */
export class DrawerDatabase extends Dexie {
   /** Flat folder records. */
   folders!: EntityTable<DrawerFolderRecord, 'id'>;
   /** Flat item records (content stored inline). */
   items!: EntityTable<DrawerItemRecord, 'id'>;
   /** Singleton meta key/value rows. */
   meta!: EntityTable<DrawerMetaRecord, 'key'>;
   /** One row per character, the full character stored inline (version(2)). */
   characters!: EntityTable<CharacterRecord, 'id'>;
   /** One row per content-addressed image asset, keyed by `hash` (version(3)). */
   assets!: EntityTable<AssetRecord, 'hash'>;

   constructor() {
      super('CharactersOfTheMistDrawerDatabase');

      this.version(1).stores({
         folders: 'id, parentFolderId, [parentFolderId+order]',
         items: 'id, parentFolderId, [parentFolderId+order], game, type',
         meta: 'key',
      });

      // version(2): purely additive - declares only the NEW `characters` store.
      // Dexie carries the version(1) stores (folders/items/meta) forward unchanged,
      // so an existing drawer database upgrades by creating one empty store with no
      // transform of existing data.
      this.version(2).stores({
         characters: 'id, updatedAt, game, drawerItemId',
      });

      // version(3): purely additive - declares only the NEW `assets` store. Only
      // `hash` (primary key) and `createdAt` are indexed; the blob and metadata are
      // stored unindexed. An existing database upgrades by creating one empty store
      // with no transform of existing data.
      this.version(3).stores({
         assets: 'hash, createdAt',
      });
   }
}

/**
 * The shared singleton database instance. The repository is the only module that
 * should read or write it directly; everything else goes through the repository
 * API.
 */
export const drawerDatabase = new DrawerDatabase();
