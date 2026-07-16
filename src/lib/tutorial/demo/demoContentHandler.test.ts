// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

// -- Under Test --
import { seedDemo, teardownDemo } from './demoContentHandler';
import { disposeDemoBoard } from './demoBoardBackend';
import { disposeDemoNote } from './demoNoteBackend';
import { DEMO_BOARD_ID, DEMO_CHARACTER_ID, DEMO_NOTE_ID, DEMO_PORTAL_BOARD_ID, DEMO_PORTAL_BOARD2_ID, DEMO_PORTAL_NOTE_ID } from './demoSentinels';

// -- Store / Repo Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';
import { disposeInstance, getCharacterInstanceIds, getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { disposeBoardInstance, getBoardInstanceIds, getOrCreateBoardInstance } from '@/lib/board/boardStoreRegistry';
import { disposeNoteInstance, getNoteInstanceIds, getOrCreateNoteInstance } from '@/lib/notes/noteStoreRegistry';
import { saveCharacter } from '@/lib/character/characterRepository';
import { createNote, importNote, loadNote } from '@/lib/notes/noteRepository';
import { resolveNavChildren } from '@/lib/navigator/resolveNavChildren';
import { loadLinkMetadata } from '@/lib/portals/linkMetadata';
import { writeWorkspace, WORKSPACE_KEY } from '@/lib/character/workspaceSession';
import * as assetRepository from '@/lib/assets/assetRepository';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { BoardItem, BoardItemContent } from '@/lib/types/board';
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
   disposeBoardInstance(DEMO_BOARD_ID);
   disposeDemoBoard(DEMO_BOARD_ID);
   for (const id of [DEMO_PORTAL_BOARD_ID, DEMO_PORTAL_BOARD2_ID]) {
      disposeBoardInstance(id);
      disposeDemoBoard(id);
   }
   disposeNoteInstance(DEMO_NOTE_ID);
   disposeDemoNote(DEMO_NOTE_ID);
   disposeNoteInstance(DEMO_PORTAL_NOTE_ID);
   disposeDemoNote(DEMO_PORTAL_NOTE_ID);
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

   it('leaves every table + the workspace byte-identical through a COMPLETE board run (with board edits)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      // Seed the demo board, then drive real board gestures on it - add a tile, move it, undo the move -
      // through the demo board store's own actions, proving the persist-then-resync command path runs
      // entirely in the in-memory backend and reaches Dexie for nothing.
      const handle = await seedDemo('board');
      expect(useTabManagerStore.getState().activeTabId).toBe(DEMO_BOARD_ID);
      const board = getOrCreateBoardInstance(DEMO_BOARD_ID);
      // The fixture hydrated: its representative tiles are present on the canvas.
      expect(Object.keys(board.getState().items).length).toBeGreaterThan(0);

      const addedId = 'demo-board-added-tile';
      const added: BoardItem = { id: addedId, kind: 'post-it', x: 500, y: 500, width: 180, height: 180, z: 99, content: { kind: 'post-it', mode: 'copy', data: { id: 'p-added', text: 'Dropped mid-tour' } } };
      await board.getState().actions.addItem(added);
      expect(board.getState().items[addedId]).toBeDefined();
      await board.getState().actions.moveItem(addedId, { x: 560, y: 560 });
      expect(board.getState().items[addedId]?.x).toBe(560);
      await board.getState().actions.undo();
      // The undo reverted the move in memory; the tile is still there, back at its added position.
      expect(board.getState().items[addedId]?.x).toBe(500);

      // Mid-run: every command lived in the backend, so the workspace is still untouched.
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);

      teardownDemo(handle);

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();

      // Prior state restored exactly; demo board instance gone from the registry.
      expect(useTabManagerStore.getState().openTabs).toEqual([{ id: 'baseline-char', type: 'character' }]);
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getBoardInstanceIds()).not.toContain(DEMO_BOARD_ID);
   });

   it('leaves every table + the workspace byte-identical through a SKIP board run (no edits)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      const handle = await seedDemo('board');
      teardownDemo(handle); // immediate skip: no interaction

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getBoardInstanceIds()).not.toContain(DEMO_BOARD_ID);
   });

   it('excludes the demo board from the registry lister while it is live', async () => {
      const handle = await seedDemo('board');
      expect(getBoardInstanceIds()).not.toContain(DEMO_BOARD_ID);
      teardownDemo(handle);
   });

   it('leaves every table + the workspace byte-identical through a COMPLETE note run (with body edits)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      // Seed the demo note, then type into its body and flush on unmount - the note store's debounce-save and
      // flush both route patchNote to the in-memory backend, so the persist path reaches Dexie for nothing.
      const handle = await seedDemo('note');
      expect(useTabManagerStore.getState().activeTabId).toBe(DEMO_NOTE_ID);
      const note = getOrCreateNoteInstance(DEMO_NOTE_ID);
      // The fixture hydrated: the handout body is present.
      expect(note.getState().note?.body.length ?? 0).toBeGreaterThan(0);

      note.getState().actions.updateBody(`${note.getState().note!.body}\n\nScribbled mid-tour.`);
      note.getState().actions.flush();

      // Mid-run: the edit lived in the backend, so the workspace is still untouched.
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);

      teardownDemo(handle);

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();

      // Prior state restored exactly; demo note instance gone from the registry.
      expect(useTabManagerStore.getState().openTabs).toEqual([{ id: 'baseline-char', type: 'character' }]);
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getNoteInstanceIds()).not.toContain(DEMO_NOTE_ID);
   });

   it('leaves every table + the workspace byte-identical through a SKIP note run (no edits)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      const handle = await seedDemo('note');
      teardownDemo(handle); // immediate skip: no interaction

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getNoteInstanceIds()).not.toContain(DEMO_NOTE_ID);
   });

   it('leaves every table + the workspace byte-identical through a COMPLETE portal-graph run (crawl + jump + edit)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      const handle = await seedDemo('portal-graph');
      expect(useTabManagerStore.getState().activeTabId).toBe(DEMO_PORTAL_BOARD_ID);

      // Crawl the whole graph the way the Navigator does - board -> note -> board - reading every node THROUGH
      // the repository (routed to the in-memory backends: getBoard/listItems for a board, getNote for a note),
      // and assert the edges resolve to the fixture targets down to the leaf's dead end.
      const rootEdges = await resolveNavChildren({ kind: 'entity', entity: 'board', id: DEMO_PORTAL_BOARD_ID });
      expect(rootEdges).toEqual([{ target: { kind: 'entity', entity: 'note', id: DEMO_PORTAL_NOTE_ID }, label: 'Field Notes' }]);
      const noteEdges = await resolveNavChildren({ kind: 'entity', entity: 'note', id: DEMO_PORTAL_NOTE_ID });
      expect(noteEdges).toEqual([{ target: { kind: 'entity', entity: 'board', id: DEMO_PORTAL_BOARD2_ID } }]);
      const leafEdges = await resolveNavChildren({ kind: 'entity', entity: 'board', id: DEMO_PORTAL_BOARD2_ID });
      expect(leafEdges).toEqual([]);

      // The Navigator resolves each row's name via the link-metadata cache; a demo target short-circuits to the
      // backend, so it reads LIVE with its fixture name instead of a drawer miss painting it dead.
      const noteMeta = await loadLinkMetadata({ kind: 'entity', entity: 'note', id: DEMO_PORTAL_NOTE_ID });
      expect(noteMeta).toEqual({ exists: true, displayName: 'Field Notes', itemType: 'NOTE' });

      // Jump into the note the way a portal dive does: materialize its aggregate into the working table (the
      // sharp `openNoteReference -> importNote -> put`), then open its tab (hydrates a note instance, and
      // `appendAndActivateNote` persists the demo tab to localStorage - which teardown must heal).
      const noteAggregate = await loadNote(DEMO_PORTAL_NOTE_ID);
      expect(noteAggregate).toBeDefined();
      await importNote(noteAggregate!, null);
      await useTabManagerStore.getState().actions.openNoteTab(DEMO_PORTAL_NOTE_ID);
      expect(getNoteInstanceIds()).toContain(DEMO_PORTAL_NOTE_ID);
      expect(localStorage.getItem(WORKSPACE_KEY)).not.toBe(baselineWorkspace); // the jump leaked the demo tab

      // Edit the landed note (a keystroke) and flush on unmount - the note store's patchNote, routed to the backend.
      const noteInstance = getOrCreateNoteInstance(DEMO_PORTAL_NOTE_ID);
      noteInstance.getState().actions.updateBody(`${noteInstance.getState().note!.body}\n\nScribbled mid-dive.`);
      noteInstance.getState().actions.flush();

      teardownDemo(handle);

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();

      // Prior state restored exactly; every demo instance gone from both registries.
      expect(useTabManagerStore.getState().openTabs).toEqual([{ id: 'baseline-char', type: 'character' }]);
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getBoardInstanceIds()).not.toContain(DEMO_PORTAL_BOARD_ID);
      expect(getBoardInstanceIds()).not.toContain(DEMO_PORTAL_BOARD2_ID);
      expect(getNoteInstanceIds()).not.toContain(DEMO_PORTAL_NOTE_ID);
   });

   it('leaves every table + the workspace byte-identical through a SKIP portal-graph run (no interaction)', async () => {
      await seedBaseline();
      setPriorWorkspace();
      const baselineTables = await snapshotTables();
      const baselineWorkspace = localStorage.getItem(WORKSPACE_KEY);

      const handle = await seedDemo('portal-graph');
      teardownDemo(handle); // immediate skip: no interaction

      expect(await snapshotTables()).toEqual(baselineTables);
      expect(localStorage.getItem(WORKSPACE_KEY)).toBe(baselineWorkspace);
      expect(storeAssetSpy).not.toHaveBeenCalled();
      expect(useTabManagerStore.getState().activeTabId).toBe('baseline-char');
      expect(getBoardInstanceIds()).not.toContain(DEMO_PORTAL_BOARD_ID);
      expect(getBoardInstanceIds()).not.toContain(DEMO_PORTAL_BOARD2_ID);
      expect(getNoteInstanceIds()).not.toContain(DEMO_PORTAL_NOTE_ID);
   });
});
