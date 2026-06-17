// -- Library Imports --
import { Dexie, type EntityTable } from 'dexie';

// -- Type Imports --
import type { DrawerFolderRecord, DrawerItemRecord, DrawerMetaRecord } from './drawerRecords';

/**
 * The Dexie database for the normalized drawer.
 *
 * Three object stores (migration spec §1.1):
 * - `folders` — flat folder records, keyed by `id`. Indexed on `parentFolderId`
 *   and the compound `[parentFolderId+order]` (the workhorse for "ordered
 *   children of folder X").
 * - `items` — flat item records, keyed by `id`. Same parent/order indexes, plus
 *   `game` and `type` (resolved Q-5) to pre-empt future filtering/search.
 * - `meta` — singleton key/value bookkeeping (schema version, migration flag),
 *   keyed by `key`.
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

   constructor() {
      super('CharactersOfTheMistDrawerDatabase');

      this.version(1).stores({
         folders: 'id, parentFolderId, [parentFolderId+order]',
         items: 'id, parentFolderId, [parentFolderId+order], game, type',
         meta: 'key',
      });
   }
}

/**
 * The shared singleton database instance. The repository is the only module that
 * should read or write it directly; everything else goes through the repository
 * API.
 */
export const drawerDatabase = new DrawerDatabase();
