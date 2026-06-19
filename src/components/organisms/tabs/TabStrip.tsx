// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

// -- Icon Imports --
import { Plus } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { Tab } from './Tab';
import { NewTabDialog } from '@/components/organisms/dialogs/NewTabDialog';

// -- Store Imports --
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { DrawerItem } from '@/lib/types/drawer';

/**
 * Desktop multi-character tab strip (tabs spec §5): a top bar over the character area,
 * to the right of the SidebarMenu. Renders the open tabs in order with a trailing `+`
 * that opens the {@link NewTabDialog}. Overflow scrolls horizontally and the active
 * tab scrolls itself into view (see `Tab`).
 *
 * The tab `SortableContext` is registered inside the **sheet's** `DndContext`
 * (`CharacterSheetPage`), not its own — the strip mounts within that subtree, so the
 * tabs reorder through the sheet's shared sensors, collision detection, drag overlay,
 * and `handleDragEnd` (which routes a `'tab'` drag to `reorderTabs`). Sharing one
 * context is what lets a tab drag later cross between the strip and the drawer.
 *
 * At zero open tabs the strip shows just the `+` and the area below renders the
 * MainMenu. Mobile does not render this strip (it stays single-character).
 */
export function TabStrip() {
   const { t } = useTranslation();
   const openTabs = useTabManagerStore((state) => state.openTabs);
   const activeTabId = useTabManagerStore((state) => state.activeTabId);
   const [isNewTabDialogOpen, setIsNewTabDialogOpen] = useState(false);

   // Drop target for dragging a FULL_CHARACTER_SHEET drawer item onto the strip to
   // open/focus it as a tab. Highlight only while a character item hovers (a
   // non-character item is a no-op and must not read as droppable).
   const { setNodeRef, isOver, active } = useDroppable({ id: 'tab-strip-drop-zone', data: { type: 'tab-strip' } });
   const activeIsCharacterItem =
      active?.data.current?.type === 'drawer-item' &&
      (active.data.current.item as DrawerItem | undefined)?.type === 'FULL_CHARACTER_SHEET';
   const showDropHighlight = isOver && Boolean(activeIsCharacterItem);

   return (
      <div
         ref={setNodeRef}
         className={cn(
            // Inset, recessed strip: the active tab below overlaps this single
            // bottom border to merge with the sheet. Tabs sit on the baseline so
            // the active one (slightly taller) stands proud of the inactive chips.
            'flex shrink-0 items-end gap-1.5 px-2 pt-2 border-b border-border bg-card overflow-x-auto overscroll-x-contain',
            showDropHighlight && 'ring-2 ring-inset ring-primary bg-primary/10',
         )}
      >
         <SortableContext items={openTabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-end gap-1.5">
               {openTabs.map((tab) => (
                  <Tab key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
               ))}
            </div>
         </SortableContext>

         <button
            type="button"
            onClick={() => setIsNewTabDialogOpen(true)}
            aria-label={t('Tabs.newTab')}
            title={t('Tabs.newTab')}
            className="shrink-0 mb-1.5 flex items-center justify-center rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
         >
            <Plus className="h-4 w-4" />
         </button>

         <NewTabDialog isOpen={isNewTabDialogOpen} onOpenChange={setIsNewTabDialogOpen} />
      </div>
   );
}
