// -- Drawer Data Layer Imports --
import { DRAWER_ROOT_PARENT_ID } from '@/lib/drawer/drawerRecords';

// -- Type Imports --
import type { DemoDrawerFixture } from './demoDrawer';
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';
import type { DrawerItemQuery, DrawerItemSummary } from '@/lib/drawer/drawerRepository';

/*
 * The in-memory backend the drawer repository funnels its READS through while the Drawer tutorial (D6) runs.
 * The departure from every other demo: the drawer is a GLOBAL singleton tree (`db.folders` + `db.items`, plain
 * cuid ids), not a per-id entity, so there is no sentinel id to route on. Instead a module-level flag
 * (`demoDrawerActive`) swaps the drawer's read surface to this fixture-backed store for the length of the tour.
 *
 * The cost-lowering fact: D6 only ever READS the drawer (its gates are open + expand; nothing in the arc
 * mutates it), so this is a READ-ONLY overlay - only the read functions are routed. The write path is left on
 * the real repository ON PURPOSE: guarding the writes behind a global flag would silently DROP a real drawer
 * write if the flag ever leaked past teardown, a far worse failure than the one it guards. The tour triggers no
 * write (the drawer's mutating controls are never a gated anchor and the overlay's veil blocks them), so nothing
 * reaches Dexie regardless.
 *
 * A pure leaf: no store, no Dexie, no React, and no runtime import of the repository it backs. The query/summary
 * TYPES come from the repository, but type-only (erased at build), so no runtime cycle forms.
 */

/** True only while a demo drawer is installed; the single switch every routed read consults. */
let demoDrawerActive = false;

/** The demo folders by id, populated by {@link installDemoDrawer}. */
const folders = new Map<string, DrawerFolderRecord>();

/** The demo items by id, populated by {@link installDemoDrawer}. */
const items = new Map<string, DrawerItemRecord>();

/** True while the demo drawer overlay is installed, so the repository routes its reads here. */
export function isDemoDrawerActive(): boolean {
   return demoDrawerActive;
}

/** Installs a fixture and turns the overlay on. The fixture is a fresh clone, owned by the backend hereafter. */
export function installDemoDrawer(fixture: DemoDrawerFixture): void {
   folders.clear();
   items.clear();
   for (const folder of fixture.folders) folders.set(folder.id, folder);
   for (const item of fixture.items) items.set(item.id, item);
   demoDrawerActive = true;
}

/** Turns the overlay off and drops the fixture. Idempotent. */
export function disposeDemoDrawer(): void {
   demoDrawerActive = false;
   folders.clear();
   items.clear();
}

// ==================
//  Internal helpers - emulate the repository's projection + query
// ==================

/** Maps the app's `string | null` parent (null = root) to the stored sentinel form. */
function toStoredParentId(parentFolderId: string | null): string {
   return parentFolderId ?? DRAWER_ROOT_PARENT_ID;
}

/** Drops the storage fields (`content`/`order`) and translates the root sentinel back to `null`. */
function toItemSummary(record: DrawerItemRecord): DrawerItemSummary {
   return {
      id: record.id,
      name: record.name,
      type: record.type,
      game: record.game,
      parentFolderId: record.parentFolderId === DRAWER_ROOT_PARENT_ID ? null : record.parentFolderId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
   };
}

/** A folder and every folder beneath it, by walking children in the fixture (mirrors the repository's subtree scope). */
function collectSubtreeFolderIds(rootFolderId: string): Set<string> {
   const collected = new Set<string>();
   const queue: string[] = [rootFolderId];
   while (queue.length > 0) {
      const folderId = queue.shift()!;
      if (collected.has(folderId)) continue;
      collected.add(folderId);
      for (const folder of folders.values()) {
         if (folder.parentFolderId === folderId) queue.push(folder.id);
      }
   }
   return collected;
}

/** Sorts matched records by the query's key + direction (default `updatedAt` desc), mirroring the repository. */
function sortItemRecords(records: DrawerItemRecord[], sort: DrawerItemQuery['sort']): DrawerItemRecord[] {
   const by = sort?.by ?? 'updatedAt';
   const factor = (sort?.direction ?? 'desc') === 'asc' ? 1 : -1;
   const compare = (a: DrawerItemRecord, b: DrawerItemRecord): number => {
      switch (by) {
         case 'name': return a.name.localeCompare(b.name);
         case 'type': return a.type.localeCompare(b.type);
         case 'createdAt': return a.createdAt - b.createdAt;
         case 'updatedAt': return a.updatedAt - b.updatedAt;
      }
   };
   return [...records].sort((a, b) => compare(a, b) * factor);
}

// ==================
//  Routed repository reads - the demo half of each `drawerRepository` read the tour touches
// ==================
//
// Each mirrors its Dexie sibling's contract but reads the in-memory fixture. Values are `structuredClone`d
// across the boundary to match Dexie's detached-copy semantics (a caller mutating a returned record must not
// corrupt the backend).

/** {@link import('@/lib/drawer/drawerRepository').getAllFolders} for the demo drawer (primes the folder-tree cache). */
export async function getAllFolders(): Promise<DrawerFolderRecord[]> {
   return [...folders.values()].map((folder) => structuredClone(folder));
}

/** {@link import('@/lib/drawer/drawerRepository').getFolderItems} for the demo drawer, ordered by sibling `order`. */
export async function getFolderItems(parentFolderId: string | null): Promise<DrawerItemRecord[]> {
   const storedParentId = toStoredParentId(parentFolderId);
   return [...items.values()]
      .filter((item) => item.parentFolderId === storedParentId)
      .sort((a, b) => a.order - b.order)
      .map((item) => structuredClone(item));
}

/** {@link import('@/lib/drawer/drawerRepository').getItemCountsForFolders} for the demo drawer. */
export async function getItemCountsForFolders(folderIds: string[]): Promise<Map<string, number>> {
   const counts = new Map<string, number>();
   for (const folderId of folderIds) {
      let count = 0;
      for (const item of items.values()) if (item.parentFolderId === folderId) count += 1;
      counts.set(folderId, count);
   }
   return counts;
}

/** {@link import('@/lib/drawer/drawerRepository').getItem} for a demo drawer item. */
export async function getItem(itemId: string): Promise<DrawerItemRecord | undefined> {
   const record = items.get(itemId);
   return record ? structuredClone(record) : undefined;
}

/**
 * {@link import('@/lib/drawer/drawerRepository').queryItems} for the demo drawer. Every provided criterion ANDs;
 * absent ones are ignored. Runs a plain in-memory filter (the Dexie sibling's index-picking is a storage
 * optimization with no in-memory analogue), then the same sort + content-free projection.
 */
export async function queryItems(query: DrawerItemQuery): Promise<DrawerItemSummary[]> {
   const { text, types, games, createdBetween, updatedBetween, scope, sort } = query;
   const needle = text ? text.toLowerCase() : null;
   const typeSet = types && types.length > 0 ? new Set(types) : null;
   const gameSet = games && games.length > 0 ? new Set(games) : null;
   const subtreeIds = scope ? collectSubtreeFolderIds(scope.folderId) : null;

   const matched = [...items.values()].filter((record) => {
      if (subtreeIds && !subtreeIds.has(record.parentFolderId)) return false;
      if (needle && !record.name.toLowerCase().includes(needle)) return false;
      if (typeSet && !typeSet.has(record.type)) return false;
      if (gameSet && !gameSet.has(record.game)) return false;
      if (createdBetween && (record.createdAt < createdBetween[0] || record.createdAt > createdBetween[1])) return false;
      if (updatedBetween && (record.updatedAt < updatedBetween[0] || record.updatedAt > updatedBetween[1])) return false;
      return true;
   });

   return sortItemRecords(matched, sort).map(toItemSummary);
}
