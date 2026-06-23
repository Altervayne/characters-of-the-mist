// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { migrateJournalContent, withPageRemoved } from './journalContent';

// -- Type Imports --
import type { JournalBoardContent } from '@/lib/types/board';

/*
 * Tests for the journal page/bookmark helpers: the legacy string-pages migration and the
 * remove-page cascade (it drops only the removed page's bookmarks, by pageId).
 */

describe('migrateJournalContent', () => {
   it('turns a legacy string-pages journal into id\'d pages (text + order preserved) with empty bookmarks', () => {
      const legacy = { kind: 'journal', pages: ['one', 'two', 'three'] } as unknown as JournalBoardContent;
      const migrated = migrateJournalContent(legacy);
      expect(migrated.pages.map((p) => p.text)).toEqual(['one', 'two', 'three']);
      expect(migrated.pages.every((p) => typeof p.id === 'string' && p.id.length > 0)).toBe(true);
      expect(new Set(migrated.pages.map((p) => p.id)).size).toBe(3); // distinct ids
      expect(migrated.bookmarks).toEqual([]);
   });

   it('is idempotent for a journal already on the object shape', () => {
      const objectShape: JournalBoardContent = { kind: 'journal', pages: [{ id: 'p1', text: 'a' }], bookmarks: [] };
      expect(migrateJournalContent(objectShape)).toBe(objectShape);
   });
});

describe('withPageRemoved', () => {
   const content: JournalBoardContent = {
      kind: 'journal',
      pages: [{ id: 'p1', text: 'a' }, { id: 'p2', text: 'b' }, { id: 'p3', text: 'c' }],
      bookmarks: [{ id: 'b1', pageId: 'p1', label: 'First' }, { id: 'b2', pageId: 'p3', label: 'Third' }],
   };

   it('drops the removed page\'s bookmark(s) and leaves the others intact (by id)', () => {
      const result = withPageRemoved(content, 'p1');
      expect(result.pages.map((p) => p.id)).toEqual(['p2', 'p3']);
      // p1's bookmark is gone; p3's survives untouched.
      expect(result.bookmarks).toEqual([{ id: 'b2', pageId: 'p3', label: 'Third' }]);
   });

   it('leaves bookmarks alone when removing an unbookmarked page', () => {
      expect(withPageRemoved(content, 'p2').bookmarks).toEqual(content.bookmarks);
   });

   it('removing the last page leaves one fresh empty page and no bookmarks', () => {
      const single: JournalBoardContent = { kind: 'journal', pages: [{ id: 'only', text: 'x' }], bookmarks: [{ id: 'b', pageId: 'only' }] };
      const result = withPageRemoved(single, 'only');
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].text).toBe('');
      expect(result.bookmarks).toEqual([]);
   });
});
