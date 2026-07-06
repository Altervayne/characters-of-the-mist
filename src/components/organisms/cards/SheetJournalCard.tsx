// -- React Imports --
import { useState } from 'react';

// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Component Imports --
import { JournalItem } from '@/components/organisms/board/items/JournalItem';
import { ToolbarHandle } from '@/components/molecules/ToolbarHandle';

// -- Hook Imports --
import { useToolbarHover } from '@/hooks/useToolbarHover';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { Journal } from '@/lib/types/board';
import type { BoardItem, BoardItemContent, JournalBoardContent } from '@/lib/types/board';

/*
 * A journal on the character sheet: the character's own paged notebook, a first-class card-element in
 * the cards flow. It sits in the same `Sortable` / `DragLayoutWrapper` the cards wear, and - like a
 * card organism - draws its own `ToolbarHandle` (grip drags via the passed listeners; trash removes the
 * journal). Reuses the board's `JournalItem` body verbatim - the same paging, pages, bookmarks, and
 * unmount-flush - without the board's copy/Save-back chrome (that lives in EmbeddedItem, which a sheet
 * journal has no use for). The body speaks the copy wrapper (`content.data`), so this host wraps the
 * bare `Journal` on the way in and unwraps it back onto `character.journals` on every edit.
 *
 * The body portals its page/bookmark controls into `toolbarSlot` and its bookmark tabs into `sideSlot`,
 * both owned here. Editing follows the sheet's edit mode: in edit mode the page is an editable textarea
 * and the controls show; at rest the page renders its Markdown. There is no board to mint onto, so a
 * tapped mention no-ops (the body's mint handler guards on an active board).
 */

interface SheetJournalCardProps {
   journal: Journal;
   /** The sheet's edit mode: drives the body's edit textarea + its structural controls, and the toolbar delete. */
   isEditing: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
}

// The body reads geometry only to place a minted mention tracker on the board; the sheet has no board,
// so a zero rect is inert.
const SHEET_HOST_RECT: BoardItem = { id: '', kind: 'journal', z: 0, x: 0, y: 0, width: 250, height: 600, content: { kind: 'journal', mode: 'copy', data: { id: '', pages: [], bookmarks: [] } } };

export function SheetJournalCard({ journal, isEditing, dragAttributes, dragListeners }: SheetJournalCardProps) {
   const { updateJournal, removeJournal } = useCharacterActions();
   const { isHovered, hoverHandlers } = useToolbarHover();

   // State-backed slots so the body re-renders to portal into them once they mount.
   const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
   const [sideSlot, setSideSlot] = useState<HTMLDivElement | null>(null);

   // The body edits a board copy wrapper; hand it the bare aggregate as `data` and unwrap on write.
   const content: JournalBoardContent = { kind: 'journal', mode: 'copy', data: journal };
   const handleContentChange = (next: BoardItemContent) => {
      if (next.kind === 'journal' && next.mode === 'copy') updateJournal(journal.id, next.data);
   };

   return (
      <motion.div {...hoverHandlers} className="relative">
         <ToolbarHandle
            isEditing={isEditing}
            isHovered={isHovered}
            dragAttributes={dragAttributes}
            dragListeners={dragListeners}
            onDelete={() => removeJournal(journal.id)}
            cardTheme="card-type-image"
         />
         {/* The outer box is NOT clipped: the clip lives on the inner wrapper (shaping the page body to
             the card), leaving the sideSlot free to protrude - the same non-clipped context the board's
             BoardItemBox gives its bookmark tabs. */}
         <div className="relative min-w-62.5 w-62.5 h-150 rounded-lg border-2 border-border bg-card text-card-foreground z-0">
            {/* Inner clip: rounds and clips only the page body to the card shape. */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
               {/* The body's structural controls (add/remove page, bookmark) portal here while editing. */}
               <div ref={setToolbarSlot} className="absolute right-1 top-1 z-10 flex items-center gap-0.5" />

               <JournalItem
                  item={SHEET_HOST_RECT}
                  content={content}
                  isSelected={isEditing}
                  toolbarSlot={toolbarSlot}
                  sideSlot={sideSlot}
                  onContentChange={handleContentChange}
                  onRequestSelect={() => {}}
               />
            </div>

            {/* Unclipped side slot at the right edge (sibling of the clip, child of the un-clipped box):
                the body's bookmark tabs portal here so they protrude into the flex-wrap gap. The high
                z-index keeps them above the neighbouring card they extend toward. */}
            <div ref={setSideSlot} className="absolute left-full top-0 z-20" />
         </div>
      </motion.div>
   );
}
