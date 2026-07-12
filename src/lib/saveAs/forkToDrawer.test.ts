// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';
import { getActiveBoardStore, getBoardInstanceIds, disposeBoardInstance, setActiveBoardInstance } from '@/lib/board/boardStoreRegistry';
import { getBoard, loadBoard } from '@/lib/board/boardRepository';
import { createItem, getItem, getBoardItemIdMap } from '@/lib/drawer/drawerRepository';
import { forkBoardToDrawerItem } from './forkToDrawer';

// -- Type Imports --
import type { Board, BoardItem } from '@/lib/types/board';

/*
 * Store-level tests for the Save-As BOARD fork's DATA + re-key ops (the parts that DON'T need a live React
 * surface): the working rows move from the old id to a fresh one, the old rows are reaped, the tab adopts the
 * new id, the ORIGINAL drawer item is untouched, the fork never conflates with the source in the resolver's
 * id map, and a subsequent plain Save writes the FORK's drawer item (not the source). The live tab re-mount /
 * surface-flush behavior is owner-cursor verification (the preview is down), NOT covered here.
 */

function installLocalStorageShim(): void {
   const store = new Map<string, string>();
   (globalThis as unknown as { localStorage: Storage }).localStorage = {
      get length() {
         return store.size;
      },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => void store.delete(key),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
   };
}

function postIt(id: string, text: string, z: number): BoardItem {
   return { id, kind: 'post-it', x: 0, y: 0, width: 100, height: 100, z, content: { kind: 'post-it', mode: 'copy', data: { id: `${id}-inner`, text } } };
}

beforeEach(async () => {
   installLocalStorageShim();
   await drawerDatabase.boards.clear();
   await drawerDatabase.boardItems.clear();
   await drawerDatabase.items.clear();
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
});

afterEach(async () => {
   getBoardInstanceIds().forEach((id) => disposeBoardInstance(id));
   setActiveBoardInstance(null);
   useTabManagerStore.setState({ openTabs: [], activeTabId: null });
   await new Promise((resolve) => setTimeout(resolve, 0));
});

/**
 * Opens a board tab, seeds it with one item, and links it to a freshly-created FULL_BOARD drawer item so it is
 * a genuine SAVED + LINKED board (the fork precondition). Returns the source ids.
 */
async function openSavedLinkedBoard(): Promise<{ sourceBoardId: string; originalItemId: string }> {
   const actions = useTabManagerStore.getState().actions;
   await actions.createBoardTab();
   const store = getActiveBoardStore()!;
   const sourceBoardId = store.getState().boardId!;
   await store.getState().actions.addItem(postIt('a', 'source note', 0));

   // Create the ORIGINAL drawer item holding the current aggregate, then link the working board to it.
   const aggregate = (await loadBoard(sourceBoardId))!;
   const original = await createItem({ name: 'My Board', game: 'NEUTRAL', type: 'FULL_BOARD', content: aggregate, parentFolderId: null });
   await store.getState().actions.linkToDrawerItem(original.id);

   return { sourceBoardId, originalItemId: original.id };
}

describe('forkBoardToDrawerItem (Save-As on a saved board)', () => {
   it('re-ids the aggregate, moves the working rows to the new id, and reaps the old ones', async () => {
      const { sourceBoardId } = await openSavedLinkedBoard();
      const newItemId = 'fork-drawer-item';

      const forked = await forkBoardToDrawerItem(newItemId);

      expect(forked).not.toBeNull();
      expect(forked!.id).not.toBe(sourceBoardId);
      expect(forked!.drawerItemId).toBe(newItemId);

      // Old working rows reaped; new working rows materialized.
      expect(await getBoard(sourceBoardId)).toBeUndefined();
      const forkRecord = await getBoard(forked!.id);
      expect(forkRecord).toBeDefined();
      expect(forkRecord!.drawerItemId).toBe(newItemId);
      const forkAggregate = (await loadBoard(forked!.id))!;
      expect(forkAggregate.items).toHaveLength(1);
      // The item id was re-minted too (a fresh, independent copy).
      expect(forkAggregate.items[0].id).not.toBe('a');
   });

   it('adopts the new id into the tab + active pointer', async () => {
      const { sourceBoardId } = await openSavedLinkedBoard();
      const forked = (await forkBoardToDrawerItem('fork-drawer-item'))!;

      const { openTabs, activeTabId } = useTabManagerStore.getState();
      expect(openTabs.map((tab) => tab.id)).toEqual([forked.id]);
      expect(openTabs.every((tab) => tab.id !== sourceBoardId)).toBe(true);
      expect(activeTabId).toBe(forked.id);

      const active = getActiveBoardStore()!.getState();
      expect(active.boardId).toBe(forked.id);
      expect(active.drawerItemId).toBe('fork-drawer-item');
   });

   it('leaves the ORIGINAL drawer item untouched (references stay on the source)', async () => {
      const { sourceBoardId, originalItemId } = await openSavedLinkedBoard();
      await forkBoardToDrawerItem('fork-drawer-item');

      const original = await getItem(originalItemId);
      expect((original!.content as Board).id).toBe(sourceBoardId);
   });

   it('does not conflate: the source and the fork resolve to DISTINCT drawer items in the id map', async () => {
      const { sourceBoardId, originalItemId } = await openSavedLinkedBoard();
      const newItemId = 'fork-drawer-item';
      const forked = (await forkBoardToDrawerItem(newItemId))!;

      // Simulate the naming window persisting the fork's drawer item (its content is the forked aggregate).
      await createItem({ id: newItemId, name: 'My Board copy', game: 'NEUTRAL', type: 'FULL_BOARD', content: forked, parentFolderId: null });

      const map = await getBoardItemIdMap();
      expect(map.get(sourceBoardId)).toBe(originalItemId);
      expect(map.get(forked.id)).toBe(newItemId);
      // Two board ids, two drawer items - no "last id wins" collapse.
      expect(map.get(sourceBoardId)).not.toBe(map.get(forked.id));
   });

   it('a subsequent plain Save writes the FORK drawer item, never the source', async () => {
      const { sourceBoardId, originalItemId } = await openSavedLinkedBoard();
      const newItemId = 'fork-drawer-item';
      const forked = (await forkBoardToDrawerItem(newItemId))!;
      // The naming window persisted the fork's drawer item.
      await createItem({ id: newItemId, name: 'My Board copy', game: 'NEUTRAL', type: 'FULL_BOARD', content: forked, parentFolderId: null });

      // Edit the fork, then plain-Save through the (now-adopted) active board store.
      const store = getActiveBoardStore()!;
      await store.getState().actions.addItem(postIt('b', 'fork-only note', 1));
      const result = await store.getState().actions.saveToDrawer();
      expect(result?.linkedItemUpdated).toBe(true);

      // The fork's drawer item captured the edit and carries the fork's board id.
      const forkItem = await getItem(newItemId);
      expect((forkItem!.content as Board).id).toBe(forked.id);
      expect((forkItem!.content as Board).items).toHaveLength(2);

      // The source drawer item is still the untouched one-item aggregate keyed by the source board id.
      const original = await getItem(originalItemId);
      expect((original!.content as Board).id).toBe(sourceBoardId);
      expect((original!.content as Board).items).toHaveLength(1);
   });
});
