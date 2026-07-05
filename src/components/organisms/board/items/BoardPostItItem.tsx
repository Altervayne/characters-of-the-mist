// -- Component Imports --
import { EmbeddedItem } from './EmbeddedItem';
import { PostItItem } from './PostItItem';

// -- Type Imports --
import type { BoardItem, BoardItemContent, PostItBoardContent } from '@/lib/types/board';

/*
 * A board POST-IT in the copy model. Copy/source machinery + the Save-back kebab live in {@link EmbeddedItem}
 * (the same chrome cards/trackers use); the editable body stays {@link PostItItem}, which reads/writes
 * `content.data`. Unlike a card/tracker copy there is NO `renderInteractive` via `InteractiveEmbed` - a note
 * is not a character aggregate, so it self-edits through its own body rather than a synthetic character store.
 * The body is passed as the copy's interactive render so it stays live and editable (the read-only snapshot
 * path is `pointer-events-none`); a note has no reference variant, so `renderSnapshot` mirrors the same body.
 */

interface BoardPostItItemProps {
   item: BoardItem;
   content: PostItBoardContent;
   isSelected: boolean;
   /** The selection toolbar's action slot; the post-it color control + the Save kebab portal here. */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   /** Adopts a Save-As drawer id onto the copy's source link via a direct (non-undoable) write. */
   onAdoptSource: (id: string, sourceDrawerItemId: string) => void;
   onDelete: (id: string) => void;
   onRequestSelect: () => void;
}

export function BoardPostItItem({ item, content, isSelected, toolbarSlot, onContentChange, onCacheLastKnown, onAdoptSource, onDelete, onRequestSelect }: BoardPostItItemProps) {
   const body = (
      <PostItItem
         item={item}
         content={content}
         isSelected={isSelected}
         toolbarSlot={toolbarSlot}
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
