// -- React Imports --
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// -- Icon Imports --
import { X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store Imports --
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Constants --
import { getGameVisual } from '@/lib/constants/gameVisuals';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/**
 * A single tab in the desktop {@link import('./TabStrip').TabStrip}. Its label is
 * live-bound to that tab's OWN store instance (not the active one), so a rename in the
 * sheet updates the tab immediately and a background tab shows its own name. The
 * instance is resolved once per tab id (idempotent + memoized) so the subscription is
 * stable and no instance is re-created on render.
 *
 * Drag-to-reorder: the tab is a `useSortable` item registered in the strip's own
 * `SortableContext`. The drag listeners sit on the label body; the strip's
 * `PointerSensor` has a small activation distance, so a click still activates and a
 * drag past the threshold reorders. The close button is a plain button (it stops the
 * pointer from starting a drag) so closing always works.
 *
 * @param props.tab - The tab descriptor (its `id` keys the store instance).
 * @param props.isActive - Whether this tab is the active one (drives the highlight).
 */
export function Tab({ tab, isActive }: { tab: OpenTab; isActive: boolean }) {
   const { t } = useTranslation();
   const { setActiveTab, closeTab } = useTabManagerActions();

   const instance = useMemo(() => getOrCreateInstance(tab.id), [tab.id]);
   const name = useStore(instance, (state) => state.character?.name);
   const game = useStore(instance, (state) => state.character?.game);
   const label = name && name.trim().length > 0 ? name : t('Tabs.untitled');

   // Left game crest: a centered, rounded, gradient-filled square with a white icon
   // and a subtle inner ring (a neutral placeholder when the game is unavailable).
   const gameVisual = getGameVisual(game);
   const GameIcon = gameVisual.Icon;

   // The discriminating payload lets the sheet's shared DnD handlers route a tab
   // drag (now in the same DndContext) without the leaf knowing about them.
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: tab.id,
      data: { type: DRAG_TYPES.TAB, tabId: tab.id },
   });

   // Compose dnd-kit's node ref with a local ref so the active tab can scroll itself
   // into view when activated (or on mount), revealing an off-screen tab.
   const localRef = useRef<HTMLDivElement | null>(null);
   const setRefs = (node: HTMLDivElement | null) => {
      setNodeRef(node);
      localRef.current = node;
   };
   useEffect(() => {
      if (isActive) localRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
   }, [isActive]);

   return (
      <div
         ref={setRefs}
         data-tab-id={tab.id}
         style={{ transform: CSS.Translate.toString(transform), transition }}
         className={cn(
            'group relative flex shrink-0 items-center gap-1.5 rounded-t-[10px] pr-1 max-w-[12rem]',
            // Active tab: same fill as the sheet, lifted above the strip's bottom
            // border and pulled down 1px to overlap it, so it reads as one surface
            // connected to the content below (no seam). Inactive tabs are lighter
            // recessed chips nudged down a touch (the strip aligns the row to its
            // baseline) so the active tab stands proud of them.
            isActive
               ? 'relative z-10 -mb-px bg-background pb-px'
               : 'mt-1 bg-muted/40 hover:bg-muted/70',
            // While dragging, the free-floating DragOverlay preview is what moves;
            // dim the in-strip source so its slot reads as a placeholder gap.
            isDragging && 'opacity-30',
         )}
      >
         <div
            aria-hidden
            className={cn(
               'ml-2 my-1.5 flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-white/25',
               gameVisual.gradient,
            )}
         >
            <GameIcon className="h-4 w-4 text-white" />
         </div>
         <button
            type="button"
            onClick={() => setActiveTab(tab.id)}
            title={label}
            {...attributes}
            {...listeners}
            className={cn(
               'min-w-0 flex-1 truncate py-2 text-sm cursor-pointer text-left touch-none select-none',
               isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
         >
            {label}
         </button>
         <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => closeTab(tab.id)}
            aria-label={t('Tabs.closeTab')}
            className="shrink-0 rounded p-1 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100 cursor-pointer"
         >
            <X className="h-3.5 w-3.5" />
         </button>
      </div>
   );
}
