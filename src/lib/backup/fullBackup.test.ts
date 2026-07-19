// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { hashBytes } from '@/lib/assets/processImage';
import { APP_VERSION } from '@/lib/config';
import {
   applyFullBackup,
   buildFullBackup,
   parseFullBackup,
   BACKUP_LOCAL_STORAGE_KEYS,
   FULL_BACKUP_FILE_TYPE,
} from './fullBackup';

// -- Type Imports --
import type { AssetRecord } from '@/lib/assets/assetRecords';
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';
import type { CharacterRecord } from '@/lib/character/characterRecords';
import type { BoardRecord, BoardItemRecord } from '@/lib/board/boardRecords';
import type { NoteRecord } from '@/lib/notes/noteRecords';

/*
 * Round-trip integration test for the full backup/restore, against fake-indexeddb + jsdom localStorage.
 * Seeds a fixture across all seven backed-up stores (including an asset Blob) plus the durable localStorage
 * keys, exports to a file string, wipes everything, and restores from the parsed file - asserting the
 * restored dataset is byte-identical: verbatim ids, asset bytes + hash surviving the base64 round-trip, and
 * the localStorage values back in place. It NEVER touches the app's live database (the singleton here is a
 * fresh in-memory store). The env is Node (working Blob), so an in-memory localStorage shim stands in.
 */

/** Installs a Map-backed localStorage on the global scope (Node has none). */
function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   (globalThis as unknown as { localStorage: Storage }).localStorage = {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
   };
}

// The raw bytes of the seeded asset; its hash is computed so the rehydrate re-hash check passes cleanly.
const ASSET_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

/** Seeds one row in every non-meta store (plus a meta row, to prove meta is excluded), returning the asset hash. */
async function seedFixture(): Promise<{ assetHash: string }> {
   const folder: DrawerFolderRecord = { id: 'folder-1', name: 'Heroes', parentFolderId: 'root', order: 0 };
   const item: DrawerItemRecord = {
      id: 'item-1', name: 'Aria', parentFolderId: 'folder-1', order: 0,
      game: 'LEGENDS', type: 'FULL_CHARACTER_SHEET', createdAt: 111, updatedAt: 222,
      content: { id: 'char-1', name: 'Aria', game: 'LEGENDS', cards: [], version: 1 } as unknown as DrawerItemRecord['content'],
   };
   const character: CharacterRecord = {
      id: 'char-1', name: 'Aria', game: 'LEGENDS', updatedAt: 222, drawerItemId: 'item-1', schemaVersion: 1,
      character: { id: 'char-1', name: 'Aria', game: 'LEGENDS', cards: [] } as unknown as CharacterRecord['character'],
   };
   const board: BoardRecord = {
      id: 'board-1', name: 'The Map', updatedAt: 333, viewport: { x: 0, y: 0, zoom: 1 },
      drawerItemId: null, nextLayerSeq: 1, schemaVersion: 1,
   };
   const boardItem: BoardItemRecord = {
      id: 'bitem-1', boardId: 'board-1', kind: 'post-it', x: 0, y: 0, width: 100, height: 100, z: 0,
      content: { kind: 'post-it', mode: 'copy', data: { id: 'n1', text: 'hi' } } as unknown as BoardItemRecord['content'],
   };
   const note: NoteRecord = { id: 'note-1', title: 'Session 1', body: '# Notes', updatedAt: 444, drawerItemId: null, schemaVersion: 1 };

   const assetHash = await hashBytes(ASSET_BYTES.buffer.slice(0));
   const asset: AssetRecord = {
      hash: assetHash, blob: new Blob([ASSET_BYTES], { type: 'image/webp' }), mimeType: 'image/webp',
      width: 2, height: 5, byteSize: ASSET_BYTES.length, createdAt: 555,
   };

   await drawerDatabase.folders.add(folder);
   await drawerDatabase.items.add(item);
   await drawerDatabase.characters.add(character);
   await drawerDatabase.boards.add(board);
   await drawerDatabase.boardItems.add(boardItem);
   await drawerDatabase.notes.add(note);
   await drawerDatabase.assets.add(asset);
   await drawerDatabase.meta.put({ key: 'schemaVersion', value: 6 });

   return { assetHash };
}

/** Clears every store (incl. meta) and every backed-up localStorage key. */
async function wipeAll(): Promise<void> {
   for (const table of drawerDatabase.tables) await table.clear();
   for (const key of BACKUP_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
}

beforeEach(async () => {
   installLocalStorageShim();
   await wipeAll();
   for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
      localStorage.setItem(key, JSON.stringify({ seeded: key }));
   }
});

describe('buildFullBackup', () => {
   it('captures every non-meta store with matching row counts, base64 assets, and the localStorage keys', async () => {
      const { assetHash } = await seedFixture();

      const backup = await buildFullBackup();

      expect(backup.fileType).toBe(FULL_BACKUP_FILE_TYPE);
      expect(backup.app).toBe('campaigns-of-the-mist');
      expect(backup.version).toBe(APP_VERSION);
      expect(typeof backup.createdAt).toBe('string');

      // Every backed-up store present with a count equal to the live table count; meta excluded.
      for (const table of drawerDatabase.tables) {
         if (table.name === 'meta') {
            expect(backup.indexeddb).not.toHaveProperty('meta');
            continue;
         }
         expect(backup.indexeddb[table.name]).toHaveLength(await table.count());
      }

      // The asset carries non-empty base64 keyed by its verbatim hash.
      const assetRows = backup.indexeddb.assets as { hash: string; base64: string }[];
      expect(assetRows).toHaveLength(1);
      expect(assetRows[0].hash).toBe(assetHash);
      expect(assetRows[0].base64.length).toBeGreaterThan(0);

      // The four durable localStorage keys captured verbatim; nothing else.
      expect(Object.keys(backup.localStorage).sort()).toEqual([...BACKUP_LOCAL_STORAGE_KEYS].sort());
      for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
         expect(backup.localStorage[key]).toBe(localStorage.getItem(key));
      }
   });
});

describe('full backup round-trip', () => {
   it('restores every store verbatim, asset bytes + hash intact, and the localStorage values', async () => {
      const { assetHash } = await seedFixture();
      const originalFolder = await drawerDatabase.folders.get('folder-1');
      const originalCharacter = await drawerDatabase.characters.get('char-1');
      const originalBoardItem = await drawerDatabase.boardItems.get('bitem-1');
      const originalLocalStorage = Object.fromEntries(
         BACKUP_LOCAL_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]),
      );

      // Export to a file string, then wipe everything and scramble localStorage - a fresh-device state.
      const fileText = JSON.stringify(await buildFullBackup());
      await wipeAll();
      for (const key of BACKUP_LOCAL_STORAGE_KEYS) localStorage.setItem(key, 'scrambled');

      await applyFullBackup(parseFullBackup(fileText));

      // Verbatim ids and record contents across every store.
      expect(await drawerDatabase.folders.get('folder-1')).toEqual(originalFolder);
      expect(await drawerDatabase.items.get('item-1')).toMatchObject({ id: 'item-1', parentFolderId: 'folder-1' });
      expect(await drawerDatabase.characters.get('char-1')).toEqual(originalCharacter);
      expect(await drawerDatabase.boards.get('board-1')).toMatchObject({ id: 'board-1', name: 'The Map' });
      expect(await drawerDatabase.boardItems.get('bitem-1')).toEqual(originalBoardItem);
      expect(await drawerDatabase.notes.get('note-1')).toMatchObject({ id: 'note-1', title: 'Session 1' });

      // The asset survives the base64 round-trip: same key, same bytes, and its bytes still hash to the key.
      const restoredAsset = await drawerDatabase.assets.get(assetHash);
      expect(restoredAsset).toBeDefined();
      const restoredBytes = new Uint8Array(await restoredAsset!.blob.arrayBuffer());
      expect(Array.from(restoredBytes)).toEqual(Array.from(ASSET_BYTES));
      expect(await hashBytes(restoredBytes.buffer.slice(0))).toBe(assetHash);

      // The durable localStorage keys are back to their pre-wipe values.
      for (const key of BACKUP_LOCAL_STORAGE_KEYS) {
         expect(localStorage.getItem(key)).toBe(originalLocalStorage[key]);
      }
   });
});
