// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

// -- Icon Imports --
import { Plus } from 'lucide-react';

// -- Component Imports --
import { Tab } from './Tab';
import { TabDragPreview } from './TabDragPreview';
import { NewTabDialog } from '@/components/organisms/dialogs/NewTabDialog';

// -- Store Imports --
import { useTabManagerStore, useTabManagerActions } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

/**
 * Desktop multi-character tab strip (tabs spec §5): a top bar over the character area,
 * to the right of the SidebarMenu. Renders the open tabs in order with a trailing `+`
 * that opens the {@link NewTabDialog}. Overflow scrolls horizontally and the active
 * tab scrolls itself into view (see `Tab`).
 *
 * Tabs are drag-reorderable. The strip owns its OWN `DndContext` + horizontal
 * `SortableContext`, deliberately separate from the character sheet's `DndContext`,
 * so tab drags never reach the sheet's card/tracker/drawer drag handlers (the repo's
 * dnd-kit isolation rule). A `PointerSensor` with a small activation distance keeps
 * single clicks (activate / close) working while a longer drag reorders.
 *
 * At zero open tabs the strip shows just the `+` and the area below renders the
 * MainMenu. Mobile does not render this strip (it stays single-character).
 */
export function TabStrip() {
   const { t } = useTranslation();
   const openTabs = useTabManagerStore((state) => state.openTabs);
   const activeTabId = useTabManagerStore((state) => state.activeTabId);
   const { reorderTabs } = useTabManagerActions();
   const [isNewTabDialogOpen, setIsNewTabDialogOpen] = useState(false);
   // The tab currently being dragged, rendered free-floating in the DragOverlay.
   const [activeDragId, setActiveDragId] = useState<string | null>(null);

   // Distance constraint: a click (no movement) still fires the tab's activate/close;
   // only a drag past 5px starts a reorder.
   const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

   const handleDragStart = (event: DragStartEvent) => {
      setActiveDragId(String(event.active.id));
   };

   const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
         reorderTabs(String(active.id), String(over.id));
      }
      setActiveDragId(null);
   };

   const draggedTab = activeDragId === null ? null : openTabs.find((tab) => tab.id === activeDragId) ?? null;

   return (
      <div className="flex shrink-0 items-stretch border-b-2 border-border bg-card overflow-x-auto overscroll-x-contain">
         <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
         >
            <SortableContext items={openTabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
               <div className="flex items-stretch">
                  {openTabs.map((tab) => (
                     <Tab key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
                  ))}
               </div>
            </SortableContext>

            {/* Free-floating preview: portals out of the strip's overflow container so
                the dragged tab follows the cursor unclipped, above everything. */}
            <DragOverlay>
               {draggedTab ? <TabDragPreview tab={draggedTab} /> : null}
            </DragOverlay>
         </DndContext>

         <button
            type="button"
            onClick={() => setIsNewTabDialogOpen(true)}
            aria-label={t('Tabs.newTab')}
            title={t('Tabs.newTab')}
            className="shrink-0 flex items-center justify-center px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
         >
            <Plus className="h-4 w-4" />
         </button>

         <NewTabDialog isOpen={isNewTabDialogOpen} onOpenChange={setIsNewTabDialogOpen} />
      </div>
   );
}
