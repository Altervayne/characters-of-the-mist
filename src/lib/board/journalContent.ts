// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { Journal, JournalBookmark, JournalPage } from '@/lib/types/board';

/*
 * Pure helpers for a journal's pages + bookmarks. They operate on the {@link Journal} aggregate (the
 * inner `data` snapshot a board copy and a drawer item both hold), not the board wrapper. Bookmarks
 * reference a page by id (never an index), so adding/removing pages never strands or re-points them.
 * Board items have no central harmonize pass, so the migration runs defensively wherever a journal is read.
 */

/**
 * Normalizes a journal to id'd pages: an old `pages: string[]` becomes `[{id, text}]`
 * (text + order preserved), and `bookmarks` defaults to `[]`. Idempotent: a journal already
 * on the object shape with a bookmarks array is returned unchanged.
 */
export function migrateJournalContent(journal: Journal): Journal {
   // Runtime-typed: legacy data violates the current types, so read the fields as unknown.
   const raw = journal as unknown as { pages?: unknown; bookmarks?: unknown };
   const pagesAreObjects = Array.isArray(raw.pages) && (raw.pages.length === 0 || typeof raw.pages[0] === 'object');
   const hasBookmarks = Array.isArray(raw.bookmarks);
   if (pagesAreObjects && hasBookmarks) return journal;

   const pages: JournalPage[] = Array.isArray(raw.pages)
      ? raw.pages.map((page) => (typeof page === 'string' ? { id: cuid(), text: page } : (page as JournalPage)))
      : [{ id: cuid(), text: '' }];
   const bookmarks: JournalBookmark[] = hasBookmarks ? (raw.bookmarks as JournalBookmark[]) : [];
   return { ...journal, pages, bookmarks };
}

/**
 * Removes the page `pageId` and drops every bookmark pointing at it (no orphan tabs), leaving
 * other bookmarks untouched. Removing the last page leaves one fresh empty page.
 */
export function withPageRemoved(journal: Journal, pageId: string): Journal {
   const pages = journal.pages.filter((page) => page.id !== pageId);
   const finalPages = pages.length > 0 ? pages : [{ id: cuid(), text: '' }];
   const bookmarks = journal.bookmarks.filter((bookmark) => bookmark.pageId !== pageId);
   return { ...journal, pages: finalPages, bookmarks };
}
