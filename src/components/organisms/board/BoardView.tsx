// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { LayoutGrid } from 'lucide-react';

// -- Store Imports --
import { useActiveBoardInstance } from '@/lib/board/ActiveBoardStoreContext';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';

/*
 * Placeholder board surface. It sits in the same content slot as the character sheet
 * (below the always-on tab strip) and reads the ACTIVE BOARD store - never the character
 * context. The real freeform canvas (pan/zoom/items) replaces this in board-6; for now
 * it just proves the active-board wiring by showing the board's name and a neutral
 * "canvas coming" state.
 */

/** The placeholder board view; renders nothing when no board tab is active. */
export function BoardView() {
   const instance = useActiveBoardInstance();
   if (!instance) return null;
   return <BoardViewContent store={instance} />;
}

/** The inner view, given a guaranteed board store, so its store hooks run unconditionally. */
function BoardViewContent({ store }: { store: BoardStore }) {
   const { t } = useTranslation();
   const name = useStore(store, (state) => state.name);
   const itemCount = useStore(store, (state) => Object.keys(state.items).length);

   return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-muted/20 p-8 text-center">
         <LayoutGrid className="h-10 w-10 text-muted-foreground" />
         <h2 className="text-xl font-semibold text-foreground">{name}</h2>
         <p className="text-sm text-muted-foreground">{t('BoardView.comingSoon')}</p>
         <p className="text-xs text-muted-foreground">{t('BoardView.itemCount', { count: itemCount })}</p>
      </div>
   );
}
