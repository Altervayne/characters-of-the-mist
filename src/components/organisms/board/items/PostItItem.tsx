// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { BoardItemContent, PostItBoardContent } from '@/lib/types/board';

/*
 * A sticky-note board item: a single editable text field filling the box. The text is
 * held locally while editing and committed once on blur (one undoable command per edit
 * session - `updateItemContent` is not coalescible, so per-keystroke commits would
 * flood undo and the repo).
 *
 * The textarea only takes pointer events when the item is selected, so an unselected
 * note drags/selects from anywhere; when selected it stops pointer propagation so
 * typing/selecting text never starts a canvas move.
 */

interface PostItItemProps {
   content: PostItBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function PostItItem({ content, isSelected, onContentChange, onRequestSelect }: PostItItemProps) {
   const { t } = useTranslation();
   const [text, setText] = useState(content.text);
   // Re-sync from the store on an external change (undo/redo) using React's
   // adjust-state-during-render pattern. While typing the stored text is unchanged
   // (commit is on blur), so this never clobbers in-progress edits.
   const [syncedText, setSyncedText] = useState(content.text);
   if (content.text !== syncedText) {
      setSyncedText(content.text);
      setText(content.text);
   }

   const commit = () => {
      if (text !== content.text) onContentChange({ kind: 'post-it', text });
   };

   return (
      <div className="h-full w-full bg-amber-200 p-2.5 text-amber-950">
         <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={onRequestSelect}
            onBlur={commit}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder={t('BoardView.postItPlaceholder')}
            className={cn(
               'h-full w-full resize-none border-0 bg-transparent text-sm leading-snug outline-none placeholder:text-amber-700/50',
               isSelected ? 'pointer-events-auto cursor-text' : 'pointer-events-none',
            )}
         />
      </div>
   );
}
