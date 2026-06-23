// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { JournalBoardContent, JournalBookmark, JournalPage } from '@/lib/types/board';

/*
 * Pure helpers for a journal's pages + bookmarks. Bookmarks reference a page by id (never an
 * index), so adding/removing pages never strands or re-points them. Board items have no
 * central harmonize pass, so the migration runs defensively wherever a journal is read.
 */

/**
 * Normalizes a journal to id'd pages: an old `pages: string[]` becomes `[{id, text}]`
 * (text + order preserved), and `bookmarks` defaults to `[]`. Idempotent: a journal already
 * on the object shape with a bookmarks array is returned unchanged.
 */
export function migrateJournalContent(content: JournalBoardContent): JournalBoardContent {
   // Runtime-typed: legacy data violates the current types, so read the fields as unknown.
   const raw = content as unknown as { pages?: unknown; bookmarks?: unknown };
   const pagesAreObjects = Array.isArray(raw.pages) && (raw.pages.length === 0 || typeof raw.pages[0] === 'object');
   const hasBookmarks = Array.isArray(raw.bookmarks);
   if (pagesAreObjects && hasBookmarks) return content;

   const pages: JournalPage[] = Array.isArray(raw.pages)
      ? raw.pages.map((page) => (typeof page === 'string' ? { id: cuid(), text: page } : (page as JournalPage)))
      : [{ id: cuid(), text: '' }];
   const bookmarks: JournalBookmark[] = hasBookmarks ? (raw.bookmarks as JournalBookmark[]) : [];
   return { ...content, pages, bookmarks };
}

/**
 * Removes the page `pageId` and drops every bookmark pointing at it (no orphan tabs), leaving
 * other bookmarks untouched. Removing the last page leaves one fresh empty page.
 */
export function withPageRemoved(content: JournalBoardContent, pageId: string): JournalBoardContent {
   const pages = content.pages.filter((page) => page.id !== pageId);
   const finalPages = pages.length > 0 ? pages : [{ id: cuid(), text: '' }];
   const bookmarks = content.bookmarks.filter((bookmark) => bookmark.pageId !== pageId);
   return { ...content, pages: finalPages, bookmarks };
}
