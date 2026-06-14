// -- React Imports --
import { useCallback } from 'react';

// -- Other Library Imports --
import type { DragEndEvent } from '@dnd-kit/core';

// -- Store Imports --
import { useDrawerActions } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Type Imports --
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';



/**
 * Drives drag-to-reorder for the mobile drawer's folders and items within the
 * currently open folder.
 *
 * Returns the @dnd-kit `handleDragEnd` handler that resolves the dragged
 * element's old/new index inside the supplied current-folder lists and dispatches
 * the matching store action (`reorderFolders` / `reorderItems`), scoped to
 * `currentFolderId` (null at the drawer root, which the store treats as the root
 * lists). Folders and items each reorder within their own list only: a drop whose
 * active and over ids are not the same drag type, or do not both resolve to an
 * index in that list, is ignored. Reordering is index-based, so the caller passes
 * the live `currentFolders` / `currentItems` arrays for the open folder in their
 * displayed order.
 *
 * @param currentFolderId - The open folder's id (null at root); the reorder parent scope.
 * @param currentFolders - The subfolders shown in the open folder, in display order.
 * @param currentItems - The items shown in the open folder, in display order.
 * @returns `{ handleDragEnd }` to wire onto the drawer's `<DndContext>`.
 */
export function useMobileDrawerDragReorder(
	currentFolderId: string | null,
	currentFolders: FolderType[],
	currentItems: DrawerItem[],
) {
	const { reorderFolders, reorderItems } = useDrawerActions();

	const handleDragEnd = useCallback((event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const activeType = active.data.current?.type as string | undefined;
		const overType = over.data.current?.type as string | undefined;
		if (!activeType || activeType !== overType) return;

		if (activeType === DRAG_TYPES.DRAWER_FOLDER) {
			const oldIndex = currentFolders.findIndex(folder => folder.id === active.id);
			const newIndex = currentFolders.findIndex(folder => folder.id === over.id);
			if (oldIndex !== -1 && newIndex !== -1) reorderFolders(currentFolderId, oldIndex, newIndex);
		} else if (activeType === DRAG_TYPES.DRAWER_ITEM) {
			const oldIndex = currentItems.findIndex(item => item.id === active.id);
			const newIndex = currentItems.findIndex(item => item.id === over.id);
			if (oldIndex !== -1 && newIndex !== -1) reorderItems(currentFolderId, oldIndex, newIndex);
		}
	}, [currentFolderId, currentFolders, currentItems, reorderFolders, reorderItems]);

	return { handleDragEnd };
}
