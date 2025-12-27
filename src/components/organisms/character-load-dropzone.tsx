

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';

// -- Icon Imports --
import { Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Variants } from 'framer-motion';
import type { Card as CardData, Tracker } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';


const overlayVariants: Variants = {
   inactive: {
      opacity: 0,
      zIndex: -1,
      transition: { duration: 0.2, ease: 'easeInOut' },
   },
   active: {
      opacity: 1,
      zIndex: 20,
      transition: { duration: 0.2, ease: 'easeInOut' },
   },
};

interface CharacterLoadDropZoneProps {
   activeDragItem: CardData | Tracker | DrawerItem | FolderType | null;
}



export function CharacterLoadDropZone({ activeDragItem }: CharacterLoadDropZoneProps) {
   const { t: t } = useTranslation();

   const isCharacterLoadDragActive =
      activeDragItem && 'content' in activeDragItem && activeDragItem.type === 'FULL_CHARACTER_SHEET';

   const { setNodeRef, isOver } = useDroppable({
      id: 'main-character-drop-zone',
      disabled: !isCharacterLoadDragActive
   });



   return (
      <motion.div
         ref={setNodeRef}
         className="relative w-full h-full inset-0 flex items-center justify-center p-3 bg-secondary/60 backdrop-blur-sm"
         variants={overlayVariants}
         initial="inactive"
         animate={isCharacterLoadDragActive ? 'active' : 'inactive'}
      >
         {isCharacterLoadDragActive && (
            <div
               className={cn(
                  'flex flex-col items-center justify-center w-full h-full text-center p-36 border-4 border-dashed border-primary/30 transition-colors',
                  { 'bg-primary/10': isOver }
               )}
            >
               <Upload className="mx-auto h-12 w-12" />
               <p className="mt-2 font-semibold">{t('CharacterSheetPage.dropToLoadCharacter')}</p>
            </div>
         )}
      </motion.div>
   );
}