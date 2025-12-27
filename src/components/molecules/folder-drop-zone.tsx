

// -- React Imports --
import React from 'react';

// -- Other Library Imports --
import { useDroppable } from '@dnd-kit/core';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface DropZoneProps {
   id: string;
   activeId: string | null;
   overId: string | null;
   data: {
      type: 'drawer-drop-zone';
      targetId: string;
      position: 'before' | 'after';
   };
}



export default function FolderDropZone({ id, activeId, overId, data }: DropZoneProps) {
   const { setNodeRef } = useDroppable({ id, data });

   const isExpanded = activeId && overId === id;



   return (
      <div ref={setNodeRef}
         className={cn(
         'w-full rounded-md border-2 border-dashed border-transparent transition-all duration-200 ease-in-out',
         isExpanded
            ? 'h-8 border-primary bg-primary/10'
            : 'h-2'
         )}
      />
   );
};