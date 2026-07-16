// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

// -- Under Test --
import { seedDemo, teardownDemo } from './demoContentHandler';
import { DEMO_CHARACTER_ID } from './demoSentinels';

// -- Store / Repo Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';
import { disposeInstance, getCharacterInstanceIds, getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { saveCharacter } from '@/lib/character/characterRepository';
import { createNote } from '@/lib/notes/noteRepository';
import { writeWorkspace, WORKSPACE_KEY } from '@/lib/character/workspaceSession';
import * as assetRepository from '@/lib/assets/assetRepository';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { BoardItemContent } from '@/lib/types/board';
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * THE INVARIANT TEST. The tutorial engine's demo handler must perform ZERO writes to any real
 * store - Dexie AND localStorage. This seeds a non-empty baseline across every table, captures a
 * CONTENT HASH per table (not a count - a count would miss an in-place mutation) plus the
 * serialized workspace, spies `storeAsset`, then runs the character demo two ways (a "complete"
 * run WITH demo-sheet edits, and a "skip" run) and asserts every hash and the workspace string are
 * byte-identical to baseline both times, with `storeAsset` never called. If this passes, the
 * demo is airtight; if it fails, the seam leaked.
 */

/** All Dexie tables in the app, with their primary-key field, for a per-table content hash. */
const TABLES: { name: string; key: string }[] = [
   { name: 'characters', key: 'id' },
   { name: 'boards', key: 'id' },
   { name: 'boardItems', key: 'id' },
   { name: 'notes', key: 'id' },
   { name: 'items', key: 'id' },
   { name: 'folders', key: 'id' },
   { name: 'assets', key: 'hash' },
];

function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   (globalThis as unknown as { localStorage: Storage }).localStorage = {
      get length() {
         return store.size;
      },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => void store.delete(k),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
   };
}

/** A stable content hash of one table: rows sorted by primary key, blobs reduced to their size. */
async function hashTable(name: string, key: string): Promise<string> {
   const rows = await (db as unknown as Record<string, { toArray(): Promise<Record<string, unknown>[]> }>)[name].toArray();
   rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
   return JSON.stringify(rows, (_field, value) => (value instanceof Blob ? `blob:${value.size}` : value));
}

/** Snapshots a content hash for every table. */
async function snapshotTables(): Promise<Record<string, string>> {
   const snapshot: Record<string, string> = {};
   for (const { name, key } of TABLES) snapshot[name] = await hashTable(name, key);
   return snapshot;
}

function makeCharacter(id: string, name: string): Character {
   return {
      id,
      name,
      game: 'LEGENDS',
      cards: [],
      journals: [],
      sheetLayout: [],
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
   };
}

/** Seeds one row into every table, so a leak would move a hash rather than merely appear from empty. */
async function seedBaseline(): Promise<void> {
   await saveCharacter(makeCharacter('baseline-char', 'Real Hero'));
   await createNote();
   await db.boards.add({
      id: 'baseline-board',
      name: 'Real Board',
      updatedAt: 1000,
      viewport: { x: 0, y: 0, zoom: 1 },
      nextLayerSeq: 0,
      schemaVersion: 1,
   });
   await db.boardItems.add({
      id: 'baseline-item',
      boardId: 'baseline-board',
      kind: 'note',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      z: 0,
      content: { kind: 'note', body: 'real tile' } as unknown as BoardItemContent,
   });
   await db.folders.add({ id: 'baseline-folder', name: 'Real Folder', parentFolderId: 'root', order: 0 });
   await db.items.add({
      id: 'baseline-drawer-item',
      name: 'Real Item',
      parentFolderId: 'root',
      order: 0,
      game: 'LEGENDS',
      type: 'STATUS_TRACKER',
      createdAt: 1000,
      updatedAt: 1000,
      content: { id: 'x', name: 'Wounded', trackerType: 'STATUS', tiers: [false, false, false, false, false, false] } as unknown as DrawerItemContent,
   });
   await db.assets.add({
      hash: 'baseline-hash',
      blob: new Blob(['real-image-bytes']),
      mimeType: 'image/webp',
      width: 10,
      height: 10,
      byteSize: 16,
      createdAt: 1000,
   });
}

/** Sets the user's "real" prior workspace, in both the store and localStorage. */
function setPriorWorkspace(): void {
   const openTabs = [{ id: 'baseline-char', type: 'character' as const }];
   useTabManagerStore.setState({ openTabs, activeTabId: 'baseline-char' });
   writeWorkspace({ openTabs, activeId: 'baseline-char' });
}

let storeAssetSpy: MockInstance;

beforeEach(async () => {
   installLocalStorageShim();
   for (const { name } of TABLES) await (db as unknown as Record<string, { clear(): Promise<void> }>)[name].clear();
   await db.meta.clear();
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
   storeAssetSpy = vi.spyOn(assetRepository, 'storeAsset');
});

afterEach(async () => {
   vi.restoreAllMocks();
   disposeInstance(DEMO_CHARACTER_ID);
   disposeInstance('baseline-char');
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
   await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('demo handler zero-write invariant', () => {
   it('leaves every table + the workspace byte-identical through a COMPLETE run (with demo edits)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      // Seed the demo, then build the sheet end to end the way D2 teaches - a status, a story tag, a
      // card, a journal, a portrait - proving even the full creation flow never leaks (there is no
      // persistence handle to carry any of it to Dexie, and the portrait writes no asset).
      const handle = await seedDemo('character');
      expect(useTabManagerStore.getState().activeTabId).toBe(DEMO_CHARACTER_ID);
      const demo = getOrCreateInstance(DEMO_CHARACTER_ID);
      demo.getState().actions.updateCharacterName('Edited In Demo');
      demo.getState().actions.addStatus('Bleeding-3');
      demo.getState().actions.addStoryTag('New lead');
      demo.getState().actions.addCard({ cardType: 'CHARACTER_THEME', themebook: 'Sample', themeType: 'Adventure', powerTagsCount: 2, weaknessTagsCount: 1 });
      demo.getState().actions.addJournal();
      demo.getState().actions.addPortrait();

      // Mid-run: every creation lived in memory, so the workspace is still untouched.
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);

      teardownDemo(handle);

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();

      // Prior state restored exactly; demo instance gone.
      expect(useTabManagerStore.getState().openTabs).toEqual([{ id: 'baseline-char', type: 'character' }]);
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getCharacterInstanceIds()).not.toContain(DEMO_CHARACTER_ID);
   });

   it('leaves every table + the workspace byte-identical through a SKIP run (no edits)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      const handle = await seedDemo('character');
      teardownDemo(handle); // immediate skip: no interaction

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
   });

   it('heals the workspace after a driven menu-swap that persists the demo tab (D1 #18 / D2 #16)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      const handle = await seedDemo('character');
      // The create-character / home-base beats drive `deactivateToMenu` then re-activate the demo tab;
      // both call `persistWorkspace`, so the demo tab DOES reach localStorage mid-run.
      const tabActions = useTabManagerStore.getState().actions;
      tabActions.deactivate();
      tabActions.setActiveTab(DEMO_CHARACTER_ID);
      expect(localStorage.getItem(WORKSPACE_KEY)).not.toBe(baselineWorkspace); // leak proven

      teardownDemo(handle);

      // Teardown re-asserts the exact prior bytes: the leak is gone and every table is untouched.
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(await snapshotTables()).toEqual(baselineTables);
      expect(storeAssetSpy).not.toHaveBeenCalled();
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getCharacterInstanceIds()).not.toContain(DEMO_CHARACTER_ID);
   });

   it('excludes the demo instance from the registry lister while it is live', async () => {
      const handle = await seedDemo('character');
      expect(getCharacterInstanceIds()).not.toContain(DEMO_CHARACTER_ID);
      teardownDemo(handle);
   });
});
