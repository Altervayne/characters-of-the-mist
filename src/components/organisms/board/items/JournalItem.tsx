// -- React Imports --
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// -- Icon Imports --
import { Bookmark, BookmarkMinus, BookMarked, ChevronLeft, ChevronRight, GripVertical, ListOrdered, Minus, Plus, X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { migrateJournalContent, withPageInserted, withPagesReordered, withPageRemoved } from '@/lib/board/journalContent';
import { restrictToParentElement, restrictToVerticalAxis } from '@/lib/theme/themeReorderModifiers';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Component Imports --
import { NoteMarkdown } from '@/components/molecules/NoteMarkdown';
import { proseMarkdownComponents } from '@/components/molecules/markdown/markdownComponents';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Sortable, DragStaticWrapper } from '@/components/dnd';

// -- Hook Imports --
import { useBoardMentionMint } from '@/hooks/board/useBoardMentionMint';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';

// -- Store Imports --
import { useJournalViewStore } from '@/lib/stores/journalViewStore';

// -- Type Imports --
import type { DragEndEvent } from '@dnd-kit/core';
import type { SortableChildProps } from '@/components/dnd';
import type { Components } from 'react-markdown';
import type { BoardItem, BoardItemContent, JournalBoardContent, JournalPage } from '@/lib/types/board';
import type { MentionSegment } from '@/lib/challenge/parseMentions';

/*
 * A paged note: one editable plain-text page at a time, with prev/next, a page indicator,
 * add/remove page, and bookmarks (side tabs that jump to a page). Pages carry stable ids and
 * bookmarks reference a pageId - never an index - so adding/removing pages never strands or
 * re-points a tab. The active page's text is held locally and committed on blur (one command
 * per edit session); each structural change (page/bookmark) is its own `updateItemContent`.
 */

interface JournalItemProps {
   /** The board item (its rect anchors a minted mention tracker beside the journal). */
   item: BoardItem;
   content: JournalBoardContent;
   isSelected: boolean;
   /** The selection toolbar's action slot; add/remove-page + bookmark portal here, nav stays in the body. */
   toolbarSlot: HTMLElement | null;
   /** A non-clipped slot at the box's right edge; the bookmark tabs portal here so they protrude. */
   sideSlot: HTMLElement | null;
   /**
    * When set, the portaled structural controls (add/remove page, bookmark) render as the host's toolbar
    * `<Button>` with this className, so a sheet journal's grip toolbar is pixel-identical to a card's.
    * The board leaves it undefined and keeps the compact `ControlButton` in its own selection toolbar.
    */
   toolbarControlClassName?: string;
   /**
    * How the bookmark list is presented. `'side-tabs'` (default, the board) portals protruding tabs into
    * `sideSlot`. `'popover'` (the sheet) instead renders a Bookmarks button in the persistent nav row that
    * opens a body-portaled list - so it floats above `flex-wrap` neighbours instead of being z-buried by them.
    */
   bookmarkMode?: 'side-tabs' | 'popover';
   /**
    * Overrides the tapped-mention handler. The board leaves it undefined and mints a board-native tracker
    * (`useBoardMentionMint`); the sheet journal passes the on-sheet create-or-raise handler so a tap creates
    * a status/tag on the active character (its fake zero-rect host means the board mint would no-op).
    */
   onMentionClick?: (segment: MentionSegment) => void;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function JournalItem({ item, content, isSelected, toolbarSlot, sideSlot, toolbarControlClassName, bookmarkMode = 'side-tabs', onMentionClick, onContentChange, onRequestSelect }: JournalItemProps) {
   const { t } = useTranslation();
   // A tapped `{mention}` mints a board-native tracker beside the journal (create-only, board scope); a host
   // that supplies its own handler (the sheet journal → create-or-raise on the character) overrides it.
   const boardMint = useBoardMentionMint(item);
   const handleMentionClick = onMentionClick ?? boardMint;

   // Normalize legacy string-page journals to id'd pages; every commit spreads this so the
   // migration persists on the first edit. The journal is the copy's inner `data` aggregate.
   const journal = useMemo(() => migrateJournalContent(content.data), [content.data]);
   const pages = journal.pages.length > 0 ? journal.pages : [{ id: '_', text: '' }];
   const bookmarks = journal.bookmarks;

   // Commits a new inner journal aggregate onto the copy's `content.data`, keeping the copy wrapper
   // (kind / mode / sourceDrawerItemId) intact so the Save-back link survives every edit.
   const commitJournal = (next: typeof journal) => onContentChange({ ...content, data: next });

   // The current page is EPHEMERAL view state (not character data): read/write an id-keyed store so it
   // survives the sheet's tab-switch unmount, and one store serves both the sheet journal and its board
   // copy (same journal id). Clamp on read - a stored index can outlive a page deletion.
   const storedIndex = useJournalViewStore((state) => state.journalView[journal.id] ?? 0);
   const setJournalPage = useJournalViewStore((state) => state.setJournalPage);
   const pageIndex = Math.min(storedIndex, pages.length - 1);
   const setIndex = (next: number) => setJournalPage(journal.id, next);
   const activePage = pages[pageIndex];
   const [text, setText] = useState(activePage.text);

   // Reset the buffer when the active page changes (switch, add/remove, undo/redo) via React's
   // adjust-state-during-render pattern. Keyed by page id + stored text, so typing (which
   // leaves both untouched) never resets the buffer mid-edit.
   const [sync, setSync] = useState({ id: activePage.id, stored: activePage.text });
   if (sync.id !== activePage.id || sync.stored !== activePage.text) {
      setSync({ id: activePage.id, stored: activePage.text });
      setText(activePage.text);
   }

   const stopDrag = (event: ReactPointerEvent) => event.stopPropagation();

   const commit = () => {
      if (text !== activePage.text) commitJournal({ ...journal, pages: pages.map((page) => (page.id === activePage.id ? { ...page, text } : page)) });
   };

   // A tab switch unmounts the board without a blur; flush the active page's buffer so it isn't lost.
   useCommitOnUnmount(commit);

   // The title is a single-line markdown heading, held in its own buffer and committed on blur. Like the
   // bookmark label it also flushes on the editable->false edge: deselecting swaps the input for the
   // rendered title in place (no unmount, maybe no blur), which would otherwise strand a just-typed title.
   const [titleText, setTitleText] = useState(journal.title);
   const [titleSync, setTitleSync] = useState(journal.title);
   if (titleSync !== journal.title) { setTitleSync(journal.title); setTitleText(journal.title); }
   const commitTitle = () => { if (titleText !== journal.title) commitJournal({ ...journal, title: titleText }); };
   useCommitOnUnmount(commitTitle);
   const wasSelected = useRef(isSelected);
   useEffect(() => {
      const was = wasSelected.current;
      wasSelected.current = isSelected;
      if (was && !isSelected) commitTitle();
   });
   // The title editor is a textarea that grows with its content (Enter adds a line, never commits); resize
   // it to fit on every change and when it (re)mounts on select.
   const titleAreaRef = useRef<HTMLTextAreaElement | null>(null);
   useLayoutEffect(() => {
      const el = titleAreaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
   }, [titleText, isSelected]);

   const goPrev = () => { commit(); setIndex(Math.max(0, pageIndex - 1)); };
   const goNext = () => { commit(); setIndex(Math.min(pages.length - 1, pageIndex + 1)); };

   // Insert a blank page at `at` (clamped), keeping the current edit, and jump to the new page. Page ids are
   // stable and bookmarks reference pageId, so inserting never strands a tab. Append (`at = length`) is the
   // toolbar's Add-page; the bottom bar inserts immediately before/after the current page.
   const insertPage = (at: number) => {
      const kept = pages.map((page) => (page.id === activePage.id ? { ...page, text } : page));
      const { journal: next, pageId } = withPageInserted({ ...journal, pages: kept }, at);
      commitJournal(next);
      setIndex(next.pages.findIndex((page) => page.id === pageId));
   };
   const addPage = () => insertPage(pages.length);

   const removePage = () => {
      const result = withPageRemoved({ ...journal, pages }, activePage.id);
      commitJournal(result);
      setIndex(Math.min(pageIndex, result.pages.length - 1));
   };

   // Drag-reorder pages from the overview popover. Page ids stay stable (bookmarks reference pageId, so a
   // reorder never strands a tab), the current edit is kept, and the view follows the current page BY ID -
   // it re-derives the active page's new index so the reader lands on the same page, not the same slot.
   const reorderPages = (activeId: string, overId: string) => {
      const kept = pages.map((page) => (page.id === activePage.id ? { ...page, text } : page));
      const next = withPagesReordered({ ...journal, pages: kept }, activeId, overId);
      commitJournal(next);
      setIndex(next.pages.findIndex((page) => page.id === activePage.id));
   };

   // The page indicator's current number is click-to-edit: a typed page (1..M) jumps there on Enter/blur,
   // anything else is ignored. Ephemeral view state, so it lives here, not on the journal aggregate.
   const [pageNumEditing, setPageNumEditing] = useState(false);
   const [pageNumText, setPageNumText] = useState('');
   const startEditPageNum = () => { setPageNumText(String(pageIndex + 1)); setPageNumEditing(true); };
   const commitPageNum = () => {
      const target = Number.parseInt(pageNumText, 10);
      if (Number.isFinite(target) && target >= 1 && target <= pages.length) { commit(); setIndex(target - 1); }
      setPageNumEditing(false);
   };

   const isBookmarked = bookmarks.some((bookmark) => bookmark.pageId === activePage.id);
   const toggleBookmark = () => {
      const next = isBookmarked
         ? bookmarks.filter((bookmark) => bookmark.pageId !== activePage.id)
         : [...bookmarks, { id: cuid(), pageId: activePage.id, label: '' }];
      commitJournal({ ...journal, bookmarks: next });
   };
   const removeBookmark = (id: string) => commitJournal({ ...journal, bookmarks: bookmarks.filter((bookmark) => bookmark.id !== id) });
   const setBookmarkLabel = (id: string, label: string) =>
      commitJournal({ ...journal, bookmarks: bookmarks.map((bookmark) => (bookmark.id === id ? { ...bookmark, label } : bookmark)) });

   const jumpToPage = (pageId: string) => {
      const target = pages.findIndex((page) => page.id === pageId);
      if (target < 0) return;
      commit();
      setIndex(target);
   };

   // Tabs in page order; a bookmark to a missing page (shouldn't happen - removal drops it) is skipped.
   const tabs = bookmarks
      .map((bookmark) => ({ bookmark, page: pages.findIndex((page) => page.id === bookmark.pageId) }))
      .filter((tab) => tab.page >= 0)
      .sort((a, b) => a.page - b.page);

   return (
      <div className="relative flex h-full w-full flex-col bg-paper-background text-paper-foreground">
         {/* Title bar (top): the notebook's multiline markdown heading - an auto-growing textarea while
             selected (Enter adds a line, never commits), inline-rendered markdown at rest (wraps, clamped
             to a few lines so a long title can't eat the journal). A body click on it falls through to select. */}
         <div className="flex shrink-0 items-start border-b border-paper-border bg-paper-primary text-paper-primary-foreground px-1.5 py-1">
            {isSelected ? (
               <textarea
                  ref={titleAreaRef}
                  value={titleText}
                  onChange={(event) => setTitleText(event.target.value)}
                  onFocus={onRequestSelect}
                  onBlur={commitTitle}
                  onPointerDown={(event) => event.stopPropagation()}
                  placeholder={t('BoardView.journalTitlePlaceholder')}
                  rows={1}
                  // Selected -> the board's wheel listener skips this so the wheel scrolls the title, not zoom.
                  data-board-wheel-scroll
                  className="max-h-24 w-full resize-none overflow-y-auto bg-transparent text-sm font-semibold leading-snug outline-none placeholder:text-paper-primary-foreground/50 cursor-text"
               />
            ) : (
               <div className="line-clamp-3 w-full whitespace-pre-wrap break-words text-sm font-semibold leading-snug">
                  {journal.title.trim()
                     ? <JournalTitle content={journal.title} />
                     : <span className="text-paper-primary-foreground/50">{t('BoardView.journalTitlePlaceholder')}</span>}
               </div>
            )}
         </div>

         {/* Structural actions live in the selection toolbar. */}
         {isSelected && toolbarSlot && createPortal(
            <>
               <ControlButton title={t('BoardView.addPage')} onPointerDown={stopDrag} onClick={addPage} toolbarClassName={toolbarControlClassName}>
                  <Plus className="h-4 w-4" />
               </ControlButton>
               <ControlButton
                  title={t('BoardView.removePage')}
                  disabled={pages.length === 1 && (pages[0]?.text ?? '') === '' && text === ''}
                  onPointerDown={stopDrag}
                  onClick={removePage}
                  toolbarClassName={toolbarControlClassName}
               >
                  <Minus className="h-4 w-4" />
               </ControlButton>
               <ControlButton title={isBookmarked ? t('BoardView.journalRemoveBookmark') : t('BoardView.journalBookmark')} onPointerDown={stopDrag} onClick={toggleBookmark} toolbarClassName={toolbarControlClassName}>
                  {isBookmarked ? <BookmarkMinus className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
               </ControlButton>
            </>,
            toolbarSlot,
         )}

         {/* Selected -> edit the page's raw Markdown; otherwise -> render it (inheriting the theme color).
             The rendered block is pointer-transparent, so a body click falls through to select (then edit). */}
         {isSelected ? (
            <textarea
               value={text}
               onChange={(event) => setText(event.target.value)}
               onFocus={onRequestSelect}
               onBlur={commit}
               onPointerDown={(event) => event.stopPropagation()}
               placeholder={t('BoardView.journalPlaceholder')}
               // Selected -> the board's wheel listener skips this so the wheel scrolls the page, not zoom.
               data-board-wheel-scroll
               className="min-h-0 flex-1 resize-none border-0 bg-transparent p-2 text-sm leading-snug outline-none placeholder:text-muted-foreground/50 cursor-text"
            />
         ) : (
            // Clip at rest (no scrollbar on a resting page); the textarea scrolls when selected.
            <div className="min-h-0 flex-1 overflow-hidden p-2">
               {text.trim() ? <NoteMarkdown content={text} onMentionClick={handleMentionClick} /> : null}
            </div>
         )}

         {/* Page navigation (bottom): the prev/next arrows sit at the far edges; a middle cluster carries the
             insert-before/after glyphs (edit-only) around the click-to-edit page number. */}
         <div className="flex shrink-0 items-center justify-between gap-0.5 border-t border-paper-border bg-paper-primary text-paper-primary-foreground px-1.5 py-1 text-xs">
            <ControlButton title={t('BoardView.prevPage')} disabled={pageIndex === 0} onPointerDown={stopDrag} onClick={goPrev}>
               <ChevronLeft className="h-3.5 w-3.5" />
            </ControlButton>

            <div className="flex items-center gap-0.5">
               {isSelected && (
                  <ControlButton title={t('BoardView.journalInsertPageBefore')} onPointerDown={stopDrag} onClick={() => insertPage(pageIndex)}>
                     <Plus className="h-3 w-3" />
                  </ControlButton>
               )}
               {/* The current page number is click-to-edit; the total stays static. Both numbers carry the
                   same width / centering / weight so `N / M` reads as a balanced pair. */}
               {pageNumEditing ? (
                  <input
                     type="text"
                     inputMode="numeric"
                     value={pageNumText}
                     autoFocus
                     onChange={(event) => setPageNumText(event.target.value.replace(/[^0-9]/g, ''))}
                     onFocus={(event) => event.target.select()}
                     onKeyDown={(event) => { if (event.key === 'Enter') commitPageNum(); else if (event.key === 'Escape') setPageNumEditing(false); }}
                     onBlur={commitPageNum}
                     onPointerDown={stopDrag}
                     aria-label={t('BoardView.journalGoToPage')}
                     // The editable number reads as a small parchment inset on the header band (the current-page indicator).
                     className="w-7 rounded bg-paper-background px-1 text-center tabular-nums text-paper-foreground outline-none"
                  />
               ) : (
                  <button
                     type="button"
                     title={t('BoardView.journalGoToPage')}
                     aria-label={t('BoardView.journalGoToPage')}
                     onPointerDown={stopDrag}
                     onClick={startEditPageNum}
                     className="min-w-7 rounded px-1 text-center tabular-nums text-paper-primary-foreground/80 hover:bg-paper-primary-foreground/10 hover:text-paper-primary-foreground cursor-pointer"
                  >
                     {pageIndex + 1}
                  </button>
               )}
               <span className="text-paper-primary-foreground/70">/</span>
               <span className="min-w-7 px-1 text-center tabular-nums text-paper-primary-foreground/80">{pages.length}</span>
               {isSelected && (
                  <ControlButton title={t('BoardView.journalInsertPageAfter')} onPointerDown={stopDrag} onClick={() => insertPage(pageIndex + 1)}>
                     <Plus className="h-3 w-3" />
                  </ControlButton>
               )}
            </div>

            <div className="flex items-center gap-0.5">
               {/* Pages overview (edit-only): a body-portaled popover listing every page (number + a first-line
                   snippet) that drags to reorder. Reordering shuffles the pages array; page ids stay stable so
                   bookmarks never strand and the reader follows the current page by id. */}
               {isSelected && (
                  <PagesReorderPopover
                     pages={pages}
                     activePageId={activePage.id}
                     triggerTitle={t('BoardView.journalReorderPages')}
                     pageLabel={(n) => t('BoardView.journalPageLabel', { number: n })}
                     emptyPageLabel={t('BoardView.journalEmptyPage')}
                     reorderLabel={t('BoardView.journalReorderPages')}
                     stopDrag={stopDrag}
                     onReorder={reorderPages}
                     onJump={jumpToPage}
                  />
               )}
               {/* Popover-mode (the sheet) puts the bookmark LIST in the always-visible nav row - the side
                   tabs are a reading affordance, so their replacement stays visible too. A body-portaled
                   popover floats above flex-wrap neighbours (no z-fighting). Always clickable, so the empty
                   state is reachable. */}
               {bookmarkMode === 'popover' && (
                  <Popover>
                     <PopoverTrigger asChild>
                        <button
                           type="button"
                           title={t('BoardView.journalBookmarks')}
                           aria-label={t('BoardView.journalBookmarks')}
                           onPointerDown={stopDrag}
                           className="flex items-center justify-center rounded p-0.5 text-paper-primary-foreground/80 hover:bg-paper-primary-foreground/10 hover:text-paper-primary-foreground cursor-pointer"
                        >
                           <BookMarked className="h-3.5 w-3.5" />
                        </button>
                     </PopoverTrigger>
                     <PopoverContent align="end" className="w-60 p-1.5" onOpenAutoFocus={(event) => event.preventDefault()}>
                        {tabs.length === 0 ? (
                           <div className="rounded-md border-2 border-dashed border-border bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
                              {t('BoardView.journalNoBookmarks')}
                           </div>
                        ) : (
                        <div className="flex flex-col gap-0.5">
                           {tabs.map(({ bookmark, page }) => (
                              <BookmarkListRow
                                 key={bookmark.id}
                                 label={bookmark.label}
                                 pageNumber={page + 1}
                                 active={page === pageIndex}
                                 editable={isSelected}
                                 placeholder={t('BoardView.journalBookmarkPlaceholder')}
                                 removeLabel={t('BoardView.journalRemoveBookmark')}
                                 onJump={() => jumpToPage(bookmark.pageId)}
                                 onRemove={() => removeBookmark(bookmark.id)}
                                 onLabelCommit={(value) => setBookmarkLabel(bookmark.id, value)}
                              />
                           ))}
                        </div>
                        )}
                     </PopoverContent>
                  </Popover>
               )}
               <ControlButton title={t('BoardView.nextPage')} disabled={pageIndex === pages.length - 1} onPointerDown={stopDrag} onClick={goNext}>
                  <ChevronRight className="h-3.5 w-3.5" />
               </ControlButton>
            </div>
         </div>

         {/* Bookmark side tabs (board default): portaled into the box's non-clipped side slot so they
             protrude past the right edge (the body keeps clipping its text). Still body-scaled + in page
             order. The wrapper stops the pointer so a tab miss never starts a canvas pan. The sheet uses
             `bookmarkMode='popover'` instead (the protruding tabs z-bury under flex-wrap neighbours). */}
         {bookmarkMode === 'side-tabs' && sideSlot && tabs.length > 0 && createPortal(
            <div onPointerDown={stopDrag} className="mt-9 flex flex-col items-start gap-1">
               {tabs.map(({ bookmark, page }) => (
                  <BookmarkTab
                     key={bookmark.id}
                     label={bookmark.label}
                     pageNumber={page + 1}
                     active={page === pageIndex}
                     editable={isSelected}
                     placeholder={t('BoardView.journalBookmarkPlaceholder')}
                     removeLabel={t('BoardView.journalRemoveBookmark')}
                     stopDrag={stopDrag}
                     onJump={() => jumpToPage(bookmark.pageId)}
                     onRemove={() => removeBookmark(bookmark.id)}
                     onLabelCommit={(value) => setBookmarkLabel(bookmark.id, value)}
                  />
               ))}
            </div>,
            sideSlot,
         )}
      </div>
   );
}

/*
 * The journal title rendered as INLINE, single-line markdown: it reuses the shared prose accents but
 * collapses the paragraph to a span, so bold/italic/strike/code/link show inline and the whole thing
 * truncates as one line (no block flow, no mentions - a heading, not an article).
 */
const TITLE_MARKDOWN_COMPONENTS: Components = {
   ...proseMarkdownComponents,
   p: ({ ...props }) => <span {...props} />,
};

function JournalTitle({ content }: { content: string }) {
   return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={TITLE_MARKDOWN_COMPONENTS}>
         {content}
      </ReactMarkdown>
   );
}

/** First non-blank line of a page's text, trimmed - the reorder row's snippet. */
function pageSnippet(text: string): string {
   return text.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
}

/**
 * The pages overview: a bar button that opens a body-portaled popover listing every page (its number + a
 * first-line snippet) as a drag-to-reorder list. Reuses the app's list-reorder pattern (a LOCAL dnd-kit
 * context, `verticalListSortingStrategy`, the vertical/parent modifiers) - never the board's own DnD. A
 * row body clicks to jump to that page; the grip carries the drag. Chrome stays app-theme (the popover
 * lives outside the paper surface).
 */
function PagesReorderPopover({
   pages,
   activePageId,
   triggerTitle,
   pageLabel,
   emptyPageLabel,
   reorderLabel,
   stopDrag,
   onReorder,
   onJump,
}: {
   pages: JournalPage[];
   activePageId: string;
   triggerTitle: string;
   pageLabel: (n: number) => string;
   emptyPageLabel: string;
   reorderLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onReorder: (activeId: string, overId: string) => void;
   onJump: (pageId: string) => void;
}) {
   // A small activation distance lets a plain click (jump) fire without starting a drag on the grip.
   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor),
   );
   const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
   };

   return (
      <Popover>
         <PopoverTrigger asChild>
            <button
               type="button"
               title={triggerTitle}
               aria-label={triggerTitle}
               onPointerDown={stopDrag}
               className="flex items-center justify-center rounded p-0.5 text-paper-primary-foreground/80 hover:bg-paper-primary-foreground/10 hover:text-paper-primary-foreground cursor-pointer"
            >
               <ListOrdered className="h-3.5 w-3.5" />
            </button>
         </PopoverTrigger>
         <PopoverContent align="end" className="w-64 p-1.5" onOpenAutoFocus={(event) => event.preventDefault()}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
               <SortableContext items={pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                     {pages.map((page, index) => (
                        <Sortable key={page.id} id={page.id} data={{ type: DRAG_TYPES.JOURNAL_PAGE, item: page }}>
                           {({ dragAttributes, dragListeners, isBeingDragged }) => (
                              <DragStaticWrapper isBeingDragged={isBeingDragged}>
                                 <PageReorderRow
                                    label={pageLabel(index + 1)}
                                    snippet={pageSnippet(page.text)}
                                    emptyLabel={emptyPageLabel}
                                    reorderLabel={reorderLabel}
                                    active={page.id === activePageId}
                                    dragAttributes={dragAttributes}
                                    dragListeners={dragListeners}
                                    onJump={() => onJump(page.id)}
                                 />
                              </DragStaticWrapper>
                           )}
                        </Sortable>
                     ))}
                  </div>
               </SortableContext>
            </DndContext>
         </PopoverContent>
      </Popover>
   );
}

/**
 * One row in the pages overview: a hover-revealed grip that carries the drag listeners, then the page's
 * number + first-line snippet as a jump button. Click jumps to the page; the grip's click is swallowed so
 * a grip tap never doubles as a jump.
 */
function PageReorderRow({
   label,
   snippet,
   emptyLabel,
   reorderLabel,
   active,
   dragAttributes,
   dragListeners,
   onJump,
}: {
   label: string;
   snippet: string;
   emptyLabel: string;
   reorderLabel: string;
   active: boolean;
   dragAttributes?: SortableChildProps['dragAttributes'];
   dragListeners?: SortableChildProps['dragListeners'];
   onJump: () => void;
}) {
   return (
      <div className={cn('flex items-center rounded-sm', active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted')}>
         <button
            type="button"
            {...dragAttributes}
            {...dragListeners}
            onClick={(event) => event.stopPropagation()}
            title={reorderLabel}
            aria-label={reorderLabel}
            className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground"
         >
            <GripVertical className="h-4 w-4" />
         </button>
         <button type="button" onClick={onJump} className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-2 text-left cursor-pointer">
            <span className="shrink-0 text-xs font-medium tabular-nums">{label}</span>
            <span className={cn('min-w-0 flex-1 truncate text-xs', snippet ? 'text-muted-foreground' : 'italic text-muted-foreground/60')}>
               {snippet || emptyLabel}
            </span>
         </button>
      </div>
   );
}

/**
 * One side tab. Click jumps to its page (and makes it active); when the journal is selected
 * and this tab is the active page, its label becomes an inline input (commit on blur). A
 * small remove (x) shows while selected.
 */
function BookmarkTab({
   label,
   pageNumber,
   active,
   editable,
   placeholder,
   removeLabel,
   stopDrag,
   onJump,
   onRemove,
   onLabelCommit,
}: {
   label?: string;
   pageNumber: number;
   active: boolean;
   editable: boolean;
   placeholder: string;
   removeLabel: string;
   stopDrag: (event: ReactPointerEvent) => void;
   onJump: () => void;
   onRemove: () => void;
   onLabelCommit: (value: string) => void;
}) {
   const [value, setValue] = useState(label ?? '');
   const [synced, setSynced] = useState(label ?? '');
   if ((label ?? '') !== synced) {
      setSynced(label ?? '');
      setValue(label ?? '');
   }
   const commit = () => {
      const trimmed = value.trim();
      if (trimmed !== (label ?? '')) onLabelCommit(trimmed);
   };

   // A tab switch unmounts the tab without a blur; flush the label buffer so it isn't lost.
   useCommitOnUnmount(commit);
   // Deselecting the journal drops `editable` and swaps the <input> for the <button> in place, WITHOUT
   // unmounting the tab - so neither onBlur nor useCommitOnUnmount fires and a label typed right before
   // deselecting is stranded in the buffer. Flush on that falling edge; the commit re-renders the tab
   // with the new label immediately (dirty-guarded, so a normal blur-then-deselect no-ops).
   const wasEditable = useRef(editable);
   useEffect(() => {
      const was = wasEditable.current;
      wasEditable.current = editable;
      if (was && !editable) commit();
   });

   return (
      <div
         className={cn(
            // Attached to the page's right edge (rounded on the outer side), protruding rightward. A paper
            // document tab: the header-band tone at rest, the paper accent when it marks the current page.
            'flex items-center gap-0.5 rounded-r-md border border-l-0 border-paper-border py-0.5 text-[0.65rem] shadow-sm',
            active ? 'bg-paper-accent text-paper-primary-foreground pl-3' : 'bg-paper-primary text-paper-primary-foreground pl-1.5',
            editable ? 'pr-0.5' : 'pr-1.5',
         )}
      >
         {active && editable ? (
            <input
               type="text"
               value={value}
               onChange={(event) => setValue(event.target.value)}
               onBlur={commit}
               onPointerDown={stopDrag}
               placeholder={placeholder}
               className="w-32 bg-transparent outline-none placeholder:text-current/50"
            />
         ) : (
            // Auto-widths to the label up to a max; a long label truncates and expands on hover
            // (growing rightward, so it never shoves the stacked tabs). `title` is the fallback.
            <button
               type="button"
               title={label && label.length > 0 ? label : undefined}
               onPointerDown={stopDrag}
               onClick={onJump}
               className="max-w-[150px] truncate text-left transition-[max-width] duration-150 hover:max-w-[320px] cursor-pointer"
            >
               {label && label.length > 0 ? label : pageNumber}
            </button>
         )}
         {editable && (
            <button
               type="button"
               title={removeLabel}
               aria-label={removeLabel}
               onPointerDown={stopDrag}
               onClick={onRemove}
               className="shrink-0 rounded ml-1 p-0.5 hover:bg-background/30 cursor-pointer"
            >
               <X className="h-2.5 w-2.5" />
            </button>
         )}
      </div>
   );
}

/**
 * One row in the sheet journal's Bookmarks popover list: the same functionality the side tab gives (jump
 * to its page, an editable label while editing, a remove control), laid out as a horizontal list row
 * inside a body-portaled popover so it floats above flex-wrap neighbours instead of z-burying under them.
 */
function BookmarkListRow({
   label,
   pageNumber,
   active,
   editable,
   placeholder,
   removeLabel,
   onJump,
   onRemove,
   onLabelCommit,
}: {
   label?: string;
   pageNumber: number;
   active: boolean;
   editable: boolean;
   placeholder: string;
   removeLabel: string;
   onJump: () => void;
   onRemove: () => void;
   onLabelCommit: (value: string) => void;
}) {
   const [value, setValue] = useState(label ?? '');
   const [synced, setSynced] = useState(label ?? '');
   if ((label ?? '') !== synced) {
      setSynced(label ?? '');
      setValue(label ?? '');
   }
   const commit = () => {
      const trimmed = value.trim();
      if (trimmed !== (label ?? '')) onLabelCommit(trimmed);
   };
   // A remount (tab switch / popover close) flushes the label buffer so an edit isn't lost.
   useCommitOnUnmount(commit);
   // Deselecting while the popover stays open drops `editable` and removes the <input> in place without
   // unmounting the row - the same stranded-buffer gap the side tab has; flush on that falling edge.
   const wasEditable = useRef(editable);
   useEffect(() => {
      const was = wasEditable.current;
      wasEditable.current = editable;
      if (was && !editable) commit();
   });

   return (
      <div className={cn(
         'flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs',
         active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}>
         {/* The page badge doubles as the jump target, so a labelled row still shows (and jumps to) its page. */}
         <button
            type="button"
            aria-label={String(pageNumber)}
            onClick={onJump}
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-muted px-1 tabular-nums text-[0.65rem] text-muted-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer"
         >
            {pageNumber}
         </button>
         {editable ? (
            <input
               type="text"
               value={value}
               onChange={(event) => setValue(event.target.value)}
               onBlur={commit}
               placeholder={placeholder}
               className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50"
            />
         ) : (
            <button
               type="button"
               title={label && label.length > 0 ? label : undefined}
               onClick={onJump}
               className="min-w-0 flex-1 truncate text-left cursor-pointer"
            >
               {label && label.length > 0 ? label : placeholder}
            </button>
         )}
         {editable && (
            <button
               type="button"
               title={removeLabel}
               aria-label={removeLabel}
               onClick={onRemove}
               className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background/50 hover:text-destructive cursor-pointer"
            >
               <X className="h-3 w-3" />
            </button>
         )}
      </div>
   );
}

/**
 * A small icon control in the journal's bar; stops the drag and fires its click. The default is a compact
 * transparent button tinted for the paper HEADER band it sits on (the footer pages bar); a host that hosts
 * these in its own card toolbar passes `toolbarClassName`, which switches to the shared
 * `<Button variant="outline" size="icon">` with that className so the control is pixel-identical to the
 * toolbar's other buttons (grip / delete / flip).
 */
function ControlButton({
   title,
   disabled = false,
   onClick,
   onPointerDown,
   toolbarClassName,
   children,
}: {
   title: string;
   disabled?: boolean;
   onClick: () => void;
   onPointerDown: (event: ReactPointerEvent) => void;
   toolbarClassName?: string;
   children: React.ReactNode;
}) {
   if (toolbarClassName) {
      return (
         <Button
            variant="outline"
            size="icon"
            title={title}
            aria-label={title}
            disabled={disabled}
            onPointerDown={onPointerDown}
            onClick={onClick}
            className={toolbarClassName}
         >
            {children}
         </Button>
      );
   }
   return (
      <button
         type="button"
         title={title}
         aria-label={title}
         disabled={disabled}
         onPointerDown={onPointerDown}
         onClick={onClick}
         className="flex items-center justify-center rounded p-0.5 text-paper-primary-foreground/80 hover:bg-paper-primary-foreground/10 hover:text-paper-primary-foreground disabled:opacity-40 disabled:cursor-default cursor-pointer"
      >
         {children}
      </button>
   );
}
