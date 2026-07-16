// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Basic UI Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Undo, Redo } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

/*
 * The presentational undo/redo pair for the sidebar. It is pure - no store, no
 * knowledge of WHAT it is undoing - so the character (zundo temporal) and the board
 * (command engine) can both feed it through the same {@link UndoController} shape.
 */

/** What a surface exposes to drive the sidebar undo/redo buttons. */
export interface UndoController {
   undo: () => void;
   redo: () => void;
   canUndo: boolean;
   canRedo: boolean;
}

export function UndoRedoButtons({ controller, isCollapsed }: { controller: UndoController; isCollapsed: boolean }) {
   const { t } = useTranslation();
   const { undo, redo, canUndo, canRedo } = controller;

   return (
      <motion.div
         data-tutorial="menu-undo-redo-buttons"
         layout
         className={cn(
            'flex items-center gap-2 mt-2 justify-evenly',
            isCollapsed ? 'flex-col px-2 grow' : 'flex-row px-4',
         )}
      >
         <IconButton
            layout
            transition={{ duration: 0.1 }}
            variant="outline"
            size="sm"
            onClick={() => undo()}
            disabled={!canUndo}
            aria-label={t('Actions.undo')}
            title={t('Actions.undo')}
            className={cn(
               isCollapsed ? 'w-10 h-10' : 'h-8 flex justify-evenly flex-1 min-w-0 max-w-32',
               canUndo ? 'cursor-pointer' : '',
            )}
         >
            <Undo className={cn(isCollapsed ? 'm-0 h-6 w-6' : 'ml-1 h-5 w-5 shrink-0')} />
            {!isCollapsed && <span className="truncate">{t('Actions.undo')}</span>}
         </IconButton>

         <IconButton
            layout
            transition={{ duration: 0.1 }}
            variant="outline"
            size="sm"
            onClick={() => redo()}
            disabled={!canRedo}
            aria-label={t('Actions.redo')}
            title={t('Actions.redo')}
            className={cn(
               isCollapsed ? 'w-10 h-10' : 'h-8 flex justify-evenly flex-1 min-w-0 max-w-32',
               canRedo ? 'cursor-pointer' : '',
            )}
         >
            {!isCollapsed && <span className="truncate">{t('Actions.redo')}</span>}
            <Redo className={cn(isCollapsed ? 'm-0 h-6 w-6' : 'ml-1 h-5 w-5 shrink-0')} />
         </IconButton>
      </motion.div>
   );
}
