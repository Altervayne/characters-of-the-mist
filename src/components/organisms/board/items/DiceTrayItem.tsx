// -- Component Imports --
import { DiceTray } from '@/components/molecules/dice/DiceTray';

// -- Type Imports --
import type { BoardItem, BoardItemContent, DiceTrayBoardContent } from '@/lib/types/board';
import type { DiceTrayContent } from '@/lib/dice/diceTrayTypes';

/*
 * The board's dice tray: a thin adapter over the reusable {@link DiceTray} core. It maps the board's
 * wiring onto the core - selection gates editing, a config edit goes to the board's UNDOABLE commit, the
 * settled roll goes to the board's NON-undoable cache, and `growToFill` renders the canvas drag-resize
 * slack so the Roll footer stays pinned. The board adds nothing to the tray beyond the item `kind` tag,
 * re-stamped on every write so the committed content stays a valid board item.
 */

interface DiceTrayItemProps {
   item: BoardItem;
   content: DiceTrayBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   /** Direct, non-undoable write - used to cache the last roll. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function DiceTrayItem({ item, content, isSelected, onContentChange, onCacheLastKnown, onRequestSelect }: DiceTrayItemProps) {
   const toBoardContent = (next: DiceTrayContent): DiceTrayBoardContent => ({ ...next, kind: 'dice-tray' });
   return (
      <DiceTray
         content={content}
         editable={isSelected}
         onChange={(next) => onContentChange(toBoardContent(next))}
         onCacheRoll={(next) => onCacheLastKnown(item.id, toBoardContent(next))}
         growToFill
         onTitleFocus={onRequestSelect}
      />
   );
}
