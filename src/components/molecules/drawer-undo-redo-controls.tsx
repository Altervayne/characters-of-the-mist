// -- React Imports--
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Undo, Redo } from 'lucide-react';

// -- Store and Hook Imports --
import useDrawerTemporalStore from '@/hooks/useDrawerTemporalStore';



export function DrawerUndoRedoControls() {
   const { t: t } = useTranslation();
   const { undo, redo, pastStates, futureStates } = useDrawerTemporalStore(
      (state) => state,
   );

   const canUndo = pastStates?.length > 1;
   const canRedo = futureStates?.length > 0;



   return (
      <div data-tour="drawer-undo-redo-buttons" className="flex items-center gap-2 justify-evenly max-w-50">
         <Button
            variant="outline"
            size="sm"
            onClick={() => undo()}
            disabled={!canUndo}
            aria-label={t('Actions.undo')}
            title={t('Actions.undo')}
            className={ canUndo ? "cursor-pointer flex-1 min-w-0" : "flex-1 min-w-0" }
         >
            <Undo className="h-4 w-4 mr-1 shrink-0" />
            <span className="truncate">{t('Actions.undo')}</span>
         </Button>
         <Button
            variant="outline"
            size="sm"
            onClick={() => redo()}
            disabled={!canRedo}
            aria-label={t('Actions.redo')}
            title={t('Actions.redo')}
            className={ canRedo ? "cursor-pointer flex-1 min-w-0" : "flex-1 min-w-0" }
         >
            <span className="truncate">{t('Actions.redo')}</span>
            <Redo className="h-4 w-4 ml-1 shrink-0" />
         </Button>
      </div>
   );
}