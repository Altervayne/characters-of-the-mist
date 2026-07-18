// -- Component Imports --
import { EmbeddedItem } from './EmbeddedItem';
import { JournalItem } from './JournalItem';

// -- Type Imports --
import type { BoardItem, BoardItemContent, JournalBoardContent } from '@/lib/types/board';

/*
 * A board JOURNAL in the copy model. Copy/source machinery + the Save-back kebab live in {@link EmbeddedItem}
 * (the same chrome cards/trackers use); the editable body stays {@link JournalItem}, which reads/writes
 * `content.data`. Unlike a card/tracker copy there is NO `renderInteractive` via `InteractiveEmbed` - a
 * journal is not a character aggregate, so it self-edits through its own body rather than a synthetic
 * character store. The body is passed as the copy's interactive render so it stays live and editable (the
 * read-only snapshot path is `pointer-events-none`); a journal has no reference variant, so `renderSnapshot`
 * mirrors the same body.
 */

interface BoardJournalItemProps {
   item: BoardItem;
   content: JournalBoardContent;
   isSelected: boolean;
   /** In its text-edit sub-state: the title + active page swap their rendered Markdown for focused editors. */
   isEditing: boolean;
   /** The selection toolbar's action slot; page/bookmark controls + the Save kebab portal here. */
   toolbarSlot: HTMLElement | null;
   /** A non-clipped slot at the box's right edge; the journal's bookmark tabs portal here so they protrude. */
   sideSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   /** Adopts a Save-As drawer id onto the copy's source link via a direct (non-undoable) write. */
   onAdoptSource: (id: string, sourceDrawerItemId: string) => void;
   onDelete: (id: string) => void;
   onRequestSelect: () => void;
}

export function BoardJournalItem({ item, content, isSelected, isEditing, toolbarSlot, sideSlot, onContentChange, onCacheLastKnown, onAdoptSource, onDelete, onRequestSelect }: BoardJournalItemProps) {
   const body = (
      <JournalItem
         item={item}
         content={content}
         isSelected={isSelected}
         isEditing={isEditing}
         autoFocusEditor
         toolbarSlot={toolbarSlot}
         sideSlot={sideSlot}
         onContentChange={onContentChange}
         onRequestSelect={onRequestSelect}
      />
   );
   return (
      <EmbeddedItem
         item={item}
         content={content}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
         onContentChange={onContentChange}
         onCacheLastKnown={onCacheLastKnown}
         onAdoptSource={onAdoptSource}
         onDelete={onDelete}
         renderSnapshot={() => body}
         renderInteractive={() => body}
      />
   );
}
