// -- React Imports --
import type { ReactNode } from 'react';

// -- Other Library Imports --
import { useDroppable } from '@dnd-kit/core';

// -- Utils Imports --
import { cn } from '@/lib/utils';



/**
 * The character sheet's main play-area drop zone, wrapping the trackers and cards
 * sections. Registers the `character-sheet-main-drop-zone` droppable - this must
 * happen inside the DndContext subtree, which is why it lives in its own
 * component rather than in the page-level DnD hook.
 */
export function SheetMainDropZone({ children }: { children: ReactNode }) {
   const { setNodeRef, isOver } = useDroppable({
      id: 'character-sheet-main-drop-zone',
      data: { type: 'character-sheet-main-drop-zone' }
   });

   return (
      <div ref={setNodeRef} className={cn(
         "flex flex-col items-center gap-8 min-h-full",
         { "bg-muted/30 rounded-lg border-2 border-primary border-dashed": isOver }
      )}>
         {children}
      </div>
   );
}
