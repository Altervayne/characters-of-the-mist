// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Utils Imports --
import { readableTextColor } from '@/lib/color';
import { pushRecentColor, readRecentColors } from '@/lib/recentColors';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';
import { NoteMarkdown } from '@/components/molecules/NoteMarkdown';

// -- Hook Imports --
import { useBoardMentionMint } from '@/hooks/board/useBoardMentionMint';

// -- Type Imports --
import type { BoardItem, BoardItemContent, PostItBoardContent } from '@/lib/types/board';

/*
 * A sticky-note board item: a single editable text field filling the box. The text is
 * held locally while editing and committed once on blur (one undoable command per edit
 * session - `updateItemContent` is not coalescible, so per-keystroke commits would flood
 * undo and the repo).
 *
 * The background color is per-note (default amber). Text color is derived from the
 * background's luminance so a note stays readable on any color.
 *
 * The textarea only takes pointer events when the item is selected, so an unselected note
 * drags/selects from anywhere; when selected it stops pointer propagation so typing never
 * starts a canvas move.
 */

/** The original amber, used when a note has no explicit color (keeps pre-color notes unchanged). */
const DEFAULT_POSTIT_COLOR = '#fde68a';
/** Curated pastel quick-picks. A pick from here is NOT a "custom" color, so it never joins recents. */
const PASTEL_PALETTE = ['#fde68a', '#fecaca', '#fbcfe8', '#ddd6fe', '#bfdbfe', '#a7f3d0', '#fed7aa', '#e2e8f0', '#a5f3fc'] as const;

interface PostItItemProps {
   /** The board item (its rect anchors a minted mention tracker beside the note). */
   item: BoardItem;
   content: PostItBoardContent;
   isSelected: boolean;
   /** The selection toolbar's action slot; the color control portals here. */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function PostItItem({ item, content, isSelected, toolbarSlot, onContentChange, onRequestSelect }: PostItItemProps) {
   const { t } = useTranslation();
   // A tapped `{mention}` in the note mints a fresh tracker beside it (create-only, board scope).
   const handleMentionClick = useBoardMentionMint(item);
   const [text, setText] = useState(content.text);
   // Re-sync from the store on an external change (undo/redo) using React's
   // adjust-state-during-render pattern. While typing the stored text is unchanged
   // (commit is on blur), so this never clobbers in-progress edits.
   const [syncedText, setSyncedText] = useState(content.text);
   if (content.text !== syncedText) {
      setSyncedText(content.text);
      setText(content.text);
   }

   // The in-progress color while the picker is open (so the box previews live before the
   // single undoable commit). `color: undefined` previews a removal back to amber.
   const [pending, setPending] = useState<{ color: string | undefined } | null>(null);
   const background = pending ? pending.color ?? DEFAULT_POSTIT_COLOR : content.color ?? DEFAULT_POSTIT_COLOR;
   const textColor = readableTextColor(background);

   // The commit reads everything it needs from refs, so it is correct whether it fires from
   // the popover (Escape / swatch / remove / outside click) or from the deselect effect below
   // - and unaffected by stale closures or a same-tick apply-and-close.
   const pendingRef = useRef<{ color: string | undefined } | null>(null);
   const contentRef = useRef(content);
   const textRef = useRef(text);
   useEffect(() => { contentRef.current = content; textRef.current = text; });

   const commitPendingColor = useCallback(() => {
      const change = pendingRef.current;
      if (!change) return;
      const next = change.color;
      const current = contentRef.current;
      if (next !== current.color) {
         onContentChange(next ? { kind: 'post-it', text: textRef.current, color: next } : { kind: 'post-it', text: textRef.current });
         // Only colors picked from the full picker (not a curated pastel) join recents.
         if (next && next !== DEFAULT_POSTIT_COLOR && !PASTEL_PALETTE.includes(next as (typeof PASTEL_PALETTE)[number])) pushRecentColor(next);
      }
      pendingRef.current = null;
      setPending(null);
   }, [onContentChange]);

   // Clicking the canvas to dismiss the popover also deselects the note (unmounting the
   // control); commit any pending color here so the pick is never lost to that race.
   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- commit (and clear) a pending color after the deselect render
      if (!isSelected) commitPendingColor();
   }, [isSelected, commitPendingColor]);

   const commitText = () => {
      if (text !== content.text) onContentChange({ ...content, text });
   };

   return (
      <div className="h-full w-full" style={{ backgroundColor: background, color: textColor }}>
         {/* Selected -> edit the raw Markdown source; otherwise -> render it (inheriting the note's color).
             The rendered block is pointer-transparent, so a body click falls through to select (then edit);
             empty + unselected shows nothing, the placeholder lives in the textarea. */}
         {isSelected ? (
            <textarea
               value={text}
               onChange={(event) => setText(event.target.value)}
               onFocus={onRequestSelect}
               onBlur={commitText}
               onPointerDown={(event) => event.stopPropagation()}
               placeholder={t('BoardView.postItPlaceholder')}
               style={{ color: textColor }}
               // Selected -> the board's wheel listener skips this so the wheel scrolls the note, not zoom.
               data-board-wheel-scroll
               className="h-full w-full resize-none border-0 bg-transparent p-2.5 text-sm leading-snug outline-none placeholder:opacity-50 cursor-text"
            />
         ) : text.trim() ? (
            // Clip at rest (no scrollbar on a resting note); the textarea scrolls when selected. Padding is
            // on this scroll element (not a wrapper), so the selected textarea's scrollbar sits at the
            // post-it's edge while the text stays inset - matching the journal.
            <div className="h-full w-full overflow-hidden p-2.5">
               <NoteMarkdown content={text} onMentionClick={handleMentionClick} />
            </div>
         ) : null}

         {isSelected && toolbarSlot && createPortal(
            // Pass the PENDING-aware color (like the zone's), so the picker's `value` tracks the live
            // pick instead of the committed color - otherwise a custom drag snaps back each emit.
            <PostItColorControl
               activeColor={background}
               onPreview={(color) => { pendingRef.current = { color }; setPending({ color }); }}
               onCommit={commitPendingColor}
            />,
            toolbarSlot,
         )}
      </div>
   );
}

/**
 * The post-it color control that lives in the selection toolbar: a swatch button that opens
 * the shared color popover (portaled, so it floats above the canvas). Picking previews live;
 * any close (Escape, outside click, or a discrete swatch/remove) commits the single
 * undoable change via `onOpenChange(false)`.
 */
function PostItColorControl({ activeColor, onPreview, onCommit }: { activeColor: string; onPreview: (color: string | undefined) => void; onCommit: () => void }) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);

   return (
      <ColorPickerPopover
         open={open}
         onOpenChange={(next) => { if (!next) onCommit(); setOpen(next); }}
         activeColor={activeColor}
         palette={PASTEL_PALETTE}
         recent={readRecentColors()}
         recentLabel={t('BoardView.recentColors')}
         removeLabel={t('BoardView.removeColor')}
         onApply={onPreview}
         trigger={
            <button
               type="button"
               title={t('BoardView.postItColor')}
               aria-label={t('BoardView.postItColor')}
               onPointerDown={(event) => event.stopPropagation()}
               className="flex h-6 w-6 items-center justify-center rounded border border-border"
               style={{ backgroundColor: activeColor }}
            />
         }
      />
   );
}
