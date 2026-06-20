// -- Other Library Imports --
import { useDroppable } from '@dnd-kit/core';

// -- Utils Imports --
import { cn } from '@/lib/utils';


interface DropZoneProps {
   id: string;
   activeId: string | null;
   overId: string | null;
   /**
    * Whether this slot may expand when targeted. The two slots flanking the dragged
    * folder are no-op positions (dropping there leaves it in place), so they stay a
    * constant gap and never expand; only real reorder targets light up.
    */
   canExpand?: boolean;
   data: {
      type: 'drawer-drop-zone';
      targetId: string;
      position: 'before' | 'after';
   };
}


/**
 * A folder reorder/insert slot that sits BETWEEN folders. It is a thin `h-2` gap at rest
 * and EXPANDS to `h-8` with an accent highlight when targeted during a folder drag,
 * giving a large drop target while keeping the folder rows themselves free for spring-nav
 * (dwell to drill in) and nest. Living between rows (not on them) is what lets folder
 * reorder coexist with those two behaviours.
 *
 * @param props.id - The slot's droppable id.
 * @param props.activeId - The active drag id (gates the expansion to an in-progress drag).
 * @param props.overId - The dnd-kit `over` id; the slot expands when it equals this slot.
 * @param props.data - The slot's drop payload (`targetId` + `position`).
 */
export default function FolderDropZone({ id, activeId, overId, canExpand = true, data }: DropZoneProps) {
   const { setNodeRef } = useDroppable({ id, data });

   const isExpanded = activeId && overId === id && canExpand;

   return (
      <div ref={setNodeRef}
         className={cn(
            'w-full rounded-md border-2 border-dashed border-transparent transition-all duration-200 ease-in-out',
            isExpanded ? 'h-8 border-primary bg-primary/10' : 'h-2',
         )}
      />
   );
};
