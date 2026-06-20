// -- React Imports --
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store Imports --
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';

// -- Constants --
import { getGameVisual } from '@/lib/constants/gameVisuals';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/**
 * Presentational preview of a tab, rendered inside a dnd-kit `<DragOverlay>` so the
 * dragged tab floats free of the strip's `overflow-x-auto` clipping and follows the
 * cursor. It mirrors a real {@link import('./Tab').Tab}, the game-icon block and the
 * live-bound label, but has no activate/close handlers (it is purely visual).
 *
 * Built as its own component so the upcoming shared-`DndContext` work can reuse it to
 * render a tab preview when a tab is the active drag, rather than rebuilding it.
 *
 * @param props.tab - The tab being dragged (its `id` keys the store instance read for the label/game).
 */
export function TabDragPreview({ tab }: { tab: OpenTab }) {
   const { t } = useTranslation();

   const instance = useMemo(() => getOrCreateInstance(tab.id), [tab.id]);
   const name = useStore(instance, (state) => state.character?.name);
   const game = useStore(instance, (state) => state.character?.game);
   const label = name && name.trim().length > 0 ? name : t('Tabs.untitled');

   const gameVisual = getGameVisual(game);
   const GameIcon = gameVisual.Icon;

   return (
      // Mirrors the active Tab (gradient crest + inner ring, label, close glyph) but
      // as a free-floating chip: rounded on ALL four corners (the tab is rounded-top
      // only) with a drop shadow.
      <div className="flex h-full w-full items-center gap-1.5 overflow-hidden rounded-[10px] border border-border bg-background shadow-lg cursor-grabbing pr-1">
         <div
            aria-hidden
            className={cn(
               'ml-2 my-1.5 flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-white/25',
               gameVisual.gradient,
            )}
         >
            <GameIcon className="h-4 w-4 text-white" />
         </div>
         <span className="min-w-0 flex-1 truncate py-2 text-sm font-medium text-foreground">{label}</span>
         <span aria-hidden className="shrink-0 rounded p-1 text-muted-foreground opacity-60">
            <X className="h-3.5 w-3.5" />
         </span>
      </div>
   );
}
