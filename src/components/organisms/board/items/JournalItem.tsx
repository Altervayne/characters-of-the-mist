// -- React Imports --
import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { BoardItemContent, JournalBoardContent } from '@/lib/types/board';

/*
 * A paged note: one editable plain-text page at a time, with prev/next, a page
 * indicator, and add/remove page. Like the post-it, the active page's text is held
 * locally and committed on blur (one command per edit session); each structural change
 * (add/remove page) is its own `updateItemContent` with the new pages array. Rich
 * formatting is a later concern.
 */

interface JournalItemProps {
   content: JournalBoardContent;
   isSelected: boolean;
   /** The selection toolbar's action slot; add/remove-page portal here, page nav stays in the body. */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function JournalItem({ content, isSelected, toolbarSlot, onContentChange, onRequestSelect }: JournalItemProps) {
   const { t } = useTranslation();
   // A journal always has at least one page; tolerate an empty array defensively.
   const pages = content.pages.length > 0 ? content.pages : [''];
   const [index, setIndex] = useState(0);
   const pageIndex = Math.min(index, pages.length - 1);
   const activeStored = pages[pageIndex] ?? '';
   const [text, setText] = useState(activeStored);

   // Reset the buffer when the active page changes (page switch, add/remove, undo/redo),
   // via React's adjust-state-during-render pattern. Typing leaves the stored text and
   // the index untouched, so the buffer is never reset mid-edit.
   const [sync, setSync] = useState({ index: pageIndex, stored: activeStored });
   if (sync.index !== pageIndex || sync.stored !== activeStored) {
      setSync({ index: pageIndex, stored: activeStored });
      setText(activeStored);
   }

   const commit = () => {
      if (text !== (pages[pageIndex] ?? '')) {
         const next = [...pages];
         next[pageIndex] = text;
         onContentChange({ kind: 'journal', pages: next });
      }
   };

   const goPrev = () => {
      commit();
      setIndex(Math.max(0, pageIndex - 1));
   };
   const goNext = () => {
      commit();
      setIndex(Math.min(pages.length - 1, pageIndex + 1));
   };
   const addPage = () => {
      // Keep the current edit, then append a fresh page and jump to it.
      const next = [...pages];
      next[pageIndex] = text;
      next.push('');
      onContentChange({ kind: 'journal', pages: next });
      setIndex(next.length - 1);
   };
   const removePage = () => {
      const next = pages.filter((_, i) => i !== pageIndex);
      const finalPages = next.length > 0 ? next : ['']; // removing the last leaves one empty page
      onContentChange({ kind: 'journal', pages: finalPages });
      setIndex(Math.min(pageIndex, finalPages.length - 1));
   };

   const stopDrag = (event: ReactPointerEvent) => event.stopPropagation();

   return (
      <div className="flex h-full w-full flex-col bg-card text-card-foreground">
         {/* Page navigation stays in the body, beside the pages it pages through; the
             structural add/remove-page actions live in the selection toolbar. */}
         <div className="flex shrink-0 items-center justify-center gap-0.5 border-b border-border px-1.5 py-1 text-xs">
            <ControlButton title={t('BoardView.prevPage')} disabled={pageIndex === 0} onPointerDown={stopDrag} onClick={goPrev}>
               <ChevronLeft className="h-3.5 w-3.5" />
            </ControlButton>
            <span className="px-1 tabular-nums text-muted-foreground">
               {pageIndex + 1} / {pages.length}
            </span>
            <ControlButton title={t('BoardView.nextPage')} disabled={pageIndex === pages.length - 1} onPointerDown={stopDrag} onClick={goNext}>
               <ChevronRight className="h-3.5 w-3.5" />
            </ControlButton>
         </div>

         {isSelected && toolbarSlot && createPortal(
            <>
               <ControlButton title={t('BoardView.addPage')} onPointerDown={stopDrag} onClick={addPage}>
                  <Plus className="h-4 w-4" />
               </ControlButton>
               <ControlButton
                  title={t('BoardView.removePage')}
                  disabled={pages.length === 1 && (pages[0] ?? '') === '' && text === ''}
                  onPointerDown={stopDrag}
                  onClick={removePage}
               >
                  <Minus className="h-4 w-4" />
               </ControlButton>
            </>,
            toolbarSlot,
         )}

         <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={onRequestSelect}
            onBlur={commit}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder={t('BoardView.journalPlaceholder')}
            className={cn(
               'min-h-0 flex-1 resize-none border-0 bg-transparent p-2 text-sm leading-snug outline-none placeholder:text-muted-foreground/50',
               isSelected ? 'pointer-events-auto cursor-text' : 'pointer-events-none',
            )}
         />
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
