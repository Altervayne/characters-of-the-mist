'use client';

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Basic UI Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Undo, Redo } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useCharacterStore } from '@/lib/stores/characterStore';



export function CharacterUndoRedoControls({ isCollapsed }: { isCollapsed: boolean }) {
   const t = useTranslations('Actions');
   const { undo, redo, pastStates, futureStates } = useCharacterStore.temporal.getState();

   const canUndo = pastStates?.length > 1;
   const canRedo = futureStates?.length > 0;



   return (
      <motion.div
         data-tour="menu-undo-redo-buttons"
         layout 
         className={cn(
            "flex flex-grow items-center gap-2 mt-2 justify-evenly",
            isCollapsed ? "flex-col px-2" : "flex-row px-4"
         )}
      >
         <IconButton
            layout
            transition={{ duration: 0.1 }}
            variant="outline"
            size="sm"
            onClick={() => undo()}
            disabled={!canUndo}
            aria-label={t('undo')}
            className={cn(
               isCollapsed ? "w-10 h-10" : "h-8 flex justify-evenly flex-1",
               canUndo ? "cursor-pointer" : ""
            )}
         >
            <Undo className={cn(
                  isCollapsed ? "m-0 h-6 w-6" : "ml-1 h-5 w-5"
               )}
            />
            { !isCollapsed && t('undo') }
         </IconButton>

         <IconButton
            layout
            transition={{ duration: 0.1 }}
            variant="outline"
            size="sm"
            onClick={() => redo()}
            disabled={!canRedo}
            aria-label={t('redo')}
            className={cn(
               isCollapsed ? "w-10 h-10" : "h-8 flex justify-evenly flex-1",
               canRedo ? "cursor-pointer" : ""
            )}
         >
            { !isCollapsed && t('redo') }
            <Redo className={cn(
                  isCollapsed ? "m-0 h-6 w-6" : "ml-1 h-5 w-5"
               )}
            />
         </IconButton>
      </motion.div>
   );
}