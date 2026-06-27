// -- DnD Imports --
import { useDraggable } from '@dnd-kit/core';

// -- Constants --
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Type Imports --
import type { DrawerItemRecord } from '@/lib/drawer/drawerRecords';
import type { DrawerItemSummary } from '@/lib/drawer/drawerRepository';

/**
 * Makes a LOADED search result draggable OUT to the workspace. Results have no intrinsic order, so this is
 * a plain draggable - never a SortableContext member - and never reorders among themselves. The payload is
 * byte-for-byte a browse item's (`DRAWER_ITEM` + the loaded record + parent + `isDrawer`), so the existing
 * board / sheet / tab drop handlers embed it with no change. Shared by the Rich result card and the List
 * result row so their drag payload can't drift.
 */
export function useResultDraggable(summary: DrawerItemSummary, item: DrawerItemRecord) {
   return useDraggable({
      id: summary.id,
      data: { type: DRAG_TYPES.DRAWER_ITEM, item, parentFolderId: summary.parentFolderId, isDrawer: true },
   });
}
