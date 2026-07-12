// -- Library Imports --
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The addItem re-ID exemption for JOURNAL. addItem deep-re-IDs minted content so the drawer copy is
 * independent of its live source, but `deepReId` regenerates EVERY field named `id` - a journal's pages
 * have `id`, while its bookmarks reference pages by the differently-named `pageId` field, left untouched.
 * A blind re-ID would orphan every bookmark. JOURNAL is therefore exempt (like FULL_BOARD). These tests
 * capture the content addItem hands to the create command and prove the exemption keeps page<->bookmark
 * references consistent, plus a control showing the un-exempt (deepReId) path WOULD strand them.
 */

vi.mock('./appGeneralStateStore', () => ({
   useAppGeneralStateStore: { getState: () => ({ actions: { setLastModifiedStore: vi.fn() } }) },
}));

// Capture the content each create command is built with; the engine execute is a no-op.
const capturedCreateInputs: Array<{ type: string; content: unknown }> = [];
vi.mock('@/lib/drawer/drawerCommandEngine', () => ({
   drawerCommandEngine: {
      execute: vi.fn().mockResolvedValue(undefined),
      undo: vi.fn().mockResolvedValue(undefined),
      redo: vi.fn().mockResolvedValue(undefined),
      canUndo: () => false,
      canRedo: () => false,
      subscribe: vi.fn(),
   },
   createCreateItemCommand: vi.fn((input: { type: string; content: unknown }) => {
      capturedCreateInputs.push({ type: input.type, content: input.content });
      return { label: 'create-item', getCreatedItemId: () => 'new-id' };
   }),
}));

vi.mock('@/lib/drawer/drawerRepository', () => ({
   getFolderItems: vi.fn().mockResolvedValue([]),
   getItemCountsForFolders: vi.fn().mockResolvedValue(new Map()),
   queryItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/drawer/drawerFolderTree', () => ({
   getChildFolders: vi.fn(() => []),
   getChildFolderCount: vi.fn(() => 0),
   whenFolderTreeSettled: vi.fn().mockResolvedValue(undefined),
}));

// -- Local Imports (after the mocks so the store binds the mocked deps) --
import { useDrawerStore } from './drawerStore';
import { deepReId } from '@/lib/utils/drawer';
import type { Journal } from '@/lib/types/board';

/** A journal with two pages whose bookmarks reference those pages by id. */
const makeJournal = (): Journal => ({
   id: 'journal-1',
   title: '',
   pages: [
      { id: 'page-a', text: 'Session one' },
      { id: 'page-b', text: 'Session two' },
   ],
   bookmarks: [
      { id: 'bm-1', pageId: 'page-a', label: 'Start' },
      { id: 'bm-2', pageId: 'page-b', label: 'The heist' },
   ],
});

/** Every bookmark's `pageId` resolves to a real page in the journal. */
const everyBookmarkResolves = (journal: Journal): boolean => {
   const pageIds = new Set(journal.pages.map((page) => page.id));
   return journal.bookmarks.every((bookmark) => pageIds.has(bookmark.pageId));
};

describe('drawerStore.addItem - JOURNAL deepReId exemption', () => {
   beforeEach(() => {
      capturedCreateInputs.length = 0;
      vi.clearAllMocks();
   });

   it('stores a journal WITHOUT re-IDing, so every bookmark still resolves to a real page', async () => {
      const journal = makeJournal();
      await useDrawerStore.getState().actions.addItem('Campaign log', 'NEUTRAL', 'JOURNAL', journal);

      const captured = capturedCreateInputs.find((entry) => entry.type === 'JOURNAL');
      expect(captured).toBeDefined();
      const stored = captured!.content as Journal;

      // The exemption leaves ids untouched, so the references match the originals exactly.
      expect(stored.pages.map((page) => page.id)).toEqual(['page-a', 'page-b']);
      expect(stored.bookmarks.map((bookmark) => bookmark.pageId)).toEqual(['page-a', 'page-b']);
      expect(everyBookmarkResolves(stored)).toBe(true);
   });

   it('control: the generic deepReId path WOULD orphan the bookmarks (why the exemption exists)', () => {
      // `deepReId` regenerates `page.id` but leaves `bookmark.pageId` (a different field name) alone,
      // so a journal pushed through the NON-exempt path strands every bookmark. This is the landmine.
      const reIded = deepReId(makeJournal());
      expect(everyBookmarkResolves(reIded)).toBe(false);
   });
});
