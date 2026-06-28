// -- React Imports --
import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';

// -- Icon Imports --
import { Bookmark, BookmarkMinus, ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { migrateJournalContent, withPageRemoved } from '@/lib/board/journalContent';

// -- Component Imports --
import { NoteMarkdown } from '@/components/molecules/NoteMarkdown';

// -- Type Imports --
import type { BoardItemContent, JournalBoardContent } from '@/lib/types/board';

/*
 * A paged note: one editable plain-text page at a time, with prev/next, a page indicator,
 * add/remove page, and bookmarks (side tabs that jump to a page). Pages carry stable ids and
 * bookmarks reference a pageId - never an index - so adding/removing pages never strands or
 * re-points a tab. The active page's text is held locally and committed on blur (one command
 * per edit session); each structural change (page/bookmark) is its own `updateItemContent`.
 */

interface JournalItemProps {
   content: JournalBoardContent;
   isSelected: boolean;
   /** The selection toolbar's action slot; add/remove-page + bookmark portal here, nav stays in the body. */
   toolbarSlot: HTMLElement | null;
   /** A non-clipped slot at the box's right edge; the bookmark tabs portal here so they protrude. */
   sideSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function JournalItem({ content, isSelected, toolbarSlot, sideSlot, onContentChange, onRequestSelect }: JournalItemProps) {
   const { t } = useTranslation();

   // Normalize legacy string-page journals to id'd pages; every commit spreads this so the
   // migration persists on the first edit.
   const journal = useMemo(() => migrateJournalContent(content), [content]);
   const pages = journal.pages.length > 0 ? journal.pages : [{ id: '_', text: '' }];
   const bookmarks = journal.bookmarks;

   const [index, setIndex] = useState(0);
   const pageIndex = Math.min(index, pages.length - 1);
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
      if (text !== activePage.text) onContentChange({ ...journal, pages: pages.map((page) => (page.id === activePage.id ? { ...page, text } : page)) });
   };

   const goPrev = () => { commit(); setIndex(Math.max(0, pageIndex - 1)); };
   const goNext = () => { commit(); setIndex(Math.min(pages.length - 1, pageIndex + 1)); };

   const addPage = () => {
      // Keep the current edit, append a fresh page, and jump to it.
      const kept = pages.map((page) => (page.id === activePage.id ? { ...page, text } : page));
      const next = [...kept, { id: cuid(), text: '' }];
      onContentChange({ ...journal, pages: next });
      setIndex(next.length - 1);
   };

   const removePage = () => {
      const result = withPageRemoved({ ...journal, pages }, activePage.id);
      onContentChange(result);
      setIndex(Math.min(pageIndex, result.pages.length - 1));
   };

   const isBookmarked = bookmarks.some((bookmark) => bookmark.pageId === activePage.id);
   const toggleBookmark = () => {
      const next = isBookmarked
         ? bookmarks.filter((bookmark) => bookmark.pageId !== activePage.id)
         : [...bookmarks, { id: cuid(), pageId: activePage.id, label: '' }];
      onContentChange({ ...journal, bookmarks: next });
   };
   const removeBookmark = (id: string) => onContentChange({ ...journal, bookmarks: bookmarks.filter((bookmark) => bookmark.id !== id) });
   const setBookmarkLabel = (id: string, label: string) =>
      onContentChange({ ...journal, bookmarks: bookmarks.map((bookmark) => (bookmark.id === id ? { ...bookmark, label } : bookmark)) });

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
      <div className="relative flex h-full w-full flex-col bg-card text-card-foreground">
         {/* Page navigation stays in the body, beside the pages it pages through. */}
         <div className="flex shrink-0 items-center justify-center gap-0.5 border-b border-border px-1.5 py-1 text-xs">
            <ControlButton title={t('BoardView.prevPage')} disabled={pageIndex === 0} onPointerDown={stopDrag} onClick={goPrev}>
               <ChevronLeft className="h-3.5 w-3.5" />
            </ControlButton>
            <span className="px-1 tabular-nums text-muted-foreground">{pageIndex + 1} / {pages.length}</span>
            <ControlButton title={t('BoardView.nextPage')} disabled={pageIndex === pages.length - 1} onPointerDown={stopDrag} onClick={goNext}>
               <ChevronRight className="h-3.5 w-3.5" />
            </ControlButton>
         </div>

         {/* Structural actions live in the selection toolbar. */}
         {isSelected && toolbarSlot && createPortal(
            <>
               <ControlButton title={t('BoardView.addPage')} onPointerDown={stopDrag} onClick={addPage}>
                  <Plus className="h-4 w-4" />
               </ControlButton>
               <ControlButton
                  title={t('BoardView.removePage')}
                  disabled={pages.length === 1 && (pages[0]?.text ?? '') === '' && text === ''}
                  onPointerDown={stopDrag}
                  onClick={removePage}
               >
                  <Minus className="h-4 w-4" />
               </ControlButton>
               <ControlButton title={isBookmarked ? t('BoardView.journalRemoveBookmark') : t('BoardView.journalBookmark')} onPointerDown={stopDrag} onClick={toggleBookmark}>
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
               className="min-h-0 flex-1 resize-none border-0 bg-transparent p-2 text-sm leading-snug outline-none placeholder:text-muted-foreground/50 cursor-text"
            />
         ) : (
            // Clip at rest (no scrollbar on a resting page); the textarea scrolls when selected.
            <div className="min-h-0 flex-1 overflow-hidden p-2">
               {text.trim() ? <NoteMarkdown content={text} /> : null}
            </div>
         )}

         {/* Bookmark side tabs: portaled into the box's non-clipped side slot so they protrude
             past the right edge (the body keeps clipping its text). Still body-scaled + in page
             order. The wrapper stops the pointer so a tab miss never starts a canvas pan. */}
         {sideSlot && tabs.length > 0 && createPortal(
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

   return (
      <div
         className={cn(
            // Attached to the page's right edge (rounded on the outer side), protruding rightward.
            'flex items-center gap-0.5 rounded-r-md border border-l-0 border-border py-0.5 pl-1 pr-1.5 text-[0.65rem] shadow-sm',
            active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
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
               className="shrink-0 rounded p-0.5 hover:bg-background/30 cursor-pointer"
            >
               <X className="h-2.5 w-2.5" />
            </button>
         )}
      </div>
   );
}

/** A small icon control in the journal's bar; stops the drag and fires its click. */
function ControlButton({
   title,
   disabled = false,
   onClick,
   onPointerDown,
   children,
}: {
   title: string;
   disabled?: boolean;
   onClick: () => void;
   onPointerDown: (event: ReactPointerEvent) => void;
   children: React.ReactNode;
}) {
   return (
      <button
         type="button"
         title={title}
         aria-label={title}
         disabled={disabled}
         onPointerDown={onPointerDown}
         onClick={onClick}
         className="flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-default cursor-pointer"
      >
         {children}
      </button>
   );
}
