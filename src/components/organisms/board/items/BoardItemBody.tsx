// -- Component Imports --
import { PostItItem } from './PostItItem';
import { ZoneItem } from './ZoneItem';
import { JournalItem } from './JournalItem';
import { ImageItem } from './ImageItem';
import { PinItem } from './PinItem';
import { DiceTrayItem } from './DiceTrayItem';
import { BoardCardItem } from './BoardCardItem';
import { BoardTrackerItem } from './BoardTrackerItem';
import { CharacterBoardItem } from './CharacterBoardItem';

// -- Type Imports --
import type { BoardItem, BoardItemContent } from '@/lib/types/board';

/*
 * Picks the per-kind body for a board item. The board-native kinds (post-it, journal,
 * image) render their real, editable body; embedded card/tracker copies render the real
 * card/tracker component read-only; every other kind (threat, connection) falls back to
 * a generic labelled box. Content edits are dispatched through `onContentChange`,
 * already bound to this item's id by the box.
 */

interface BoardItemBodyProps {
   item: BoardItem;
   isSelected: boolean;
   /** The selection toolbar's per-kind action slot; a kind portals its actions here. Null when unselected. */
   toolbarSlot: HTMLElement | null;
   /** A non-clipped slot at the box's right edge (outside overflow-hidden); the journal portals its tabs here. */
   sideSlot: HTMLElement | null;
   /** A zone's member count, for its collapsed-bar badge (undefined for non-zones). */
   memberCount?: number;
   /** Commits new content for this item (one undoable command per edit session). */
   onContentChange: (content: BoardItemContent) => void;
   /** Caches a reference's last-known snapshot via a direct (non-undoable) write. */
   onCacheLastKnown: (id: string, content: BoardItemContent) => void;
   /** Removes this item (used by a dangling reference's placeholder). */
   onDelete: (id: string) => void;
   /** Selects this item (used by text fields that stop pointer propagation). */
   onRequestSelect: () => void;
}

export function BoardItemBody({ item, isSelected, toolbarSlot, sideSlot, memberCount, onContentChange, onCacheLastKnown, onDelete, onRequestSelect }: BoardItemBodyProps) {
   const { content } = item;

   switch (content.kind) {
      case 'post-it':
         return <PostItItem content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} onRequestSelect={onRequestSelect} />;
      case 'journal':
         return <JournalItem content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} sideSlot={sideSlot} onContentChange={onContentChange} onRequestSelect={onRequestSelect} />;
      case 'image':
         return <ImageItem content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} onRequestSelect={onRequestSelect} />;
      case 'pin':
         return <PinItem content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} />;
      case 'zone':
         return <ZoneItem content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} memberCount={memberCount} onContentChange={onContentChange} onRequestSelect={onRequestSelect} />;
      case 'dice-tray':
         return <DiceTrayItem item={item} content={content} isSelected={isSelected} onContentChange={onContentChange} onCacheLastKnown={onCacheLastKnown} onRequestSelect={onRequestSelect} />;
      case 'card':
         return <BoardCardItem item={item} content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} onCacheLastKnown={onCacheLastKnown} onDelete={onDelete} />;
      case 'tracker':
         return <BoardTrackerItem item={item} content={content} isSelected={isSelected} toolbarSlot={toolbarSlot} onContentChange={onContentChange} onCacheLastKnown={onCacheLastKnown} onDelete={onDelete} />;
      case 'character':
         return <CharacterBoardItem item={item} content={content} onCacheLastKnown={onCacheLastKnown} onDelete={onDelete} />;
      default:
         return <GenericItemBody item={item} />;
   }
}

/** The pre-board-8 generic box: kind label + live size, for kinds without a real body yet. */
function GenericItemBody({ item }: { item: BoardItem }) {
   return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card text-card-foreground">
         <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.kind}</span>
         <span className="text-[10px] text-muted-foreground">
            {Math.round(item.width)} × {Math.round(item.height)}
         </span>
      </div>
   );
}
