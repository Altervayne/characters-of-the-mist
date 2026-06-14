// -- React Imports --
import { useCallback, useMemo } from 'react';

// -- Other Library Imports --
import type { DragEndEvent } from '@dnd-kit/core';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Character, Tracker } from '@/lib/types/character';



/**
 * Drives drag-to-reorder for the mobile character sheet's three tracker groups
 * (statuses, story tags, story themes).
 *
 * Returns the memoized id arrays for each group's `SortableContext` plus the
 * @dnd-kit `handleDragEnd` handler. Reordering is constrained within a single
 * group: the handler reads the dragged and target trackers' `trackerType`, drops
 * any cross-group move, then resolves the old/new index inside the matching list
 * and dispatches the corresponding store action (`reorderStatuses` /
 * `reorderStoryTags` / `reorderStoryThemes`). Index resolution reads the live
 * `character` lists, so the displayed order is always the source of truth.
 *
 * @param character - The loaded character (or null), source of the tracker lists.
 * @returns `{ statusIds, storyTagIds, storyThemeIds, handleDragEnd }` to wire onto
 *   the trackers section's `<SortableContext>`s and `<DndContext>`.
 */
export function useMobileTrackerDragReorder(character: Character | null) {
	const { reorderStatuses, reorderStoryTags, reorderStoryThemes } = useCharacterActions();

	const statusIds = useMemo(
		() => character?.trackers.statuses.map((tracker) => tracker.id) ?? [],
		[character?.trackers.statuses]
	);
	const storyTagIds = useMemo(
		() => character?.trackers.storyTags.map((tracker) => tracker.id) ?? [],
		[character?.trackers.storyTags]
	);
	const storyThemeIds = useMemo(
		() => character?.trackers.storyThemes.map((tracker) => tracker.id) ?? [],
		[character?.trackers.storyThemes]
	);

	const handleDragEnd = useCallback((event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id || !character) return;

		const activeTracker = active.data.current?.item as Tracker | undefined;
		const overTracker = over.data.current?.item as Tracker | undefined;
		if (!activeTracker?.trackerType || !overTracker?.trackerType) return;
		// Reorder only within the same group.
		if (activeTracker.trackerType !== overTracker.trackerType) return;

		const activeId = active.id as string;
		const overId = over.id as string;

		if (activeTracker.trackerType === 'STATUS') {
			const oldIndex = character.trackers.statuses.findIndex((tracker) => tracker.id === activeId);
			const newIndex = character.trackers.statuses.findIndex((tracker) => tracker.id === overId);
			if (oldIndex !== -1 && newIndex !== -1) reorderStatuses(oldIndex, newIndex);
		} else if (activeTracker.trackerType === 'STORY_TAG') {
			const oldIndex = character.trackers.storyTags.findIndex((tracker) => tracker.id === activeId);
			const newIndex = character.trackers.storyTags.findIndex((tracker) => tracker.id === overId);
			if (oldIndex !== -1 && newIndex !== -1) reorderStoryTags(oldIndex, newIndex);
		} else if (activeTracker.trackerType === 'STORY_THEME') {
			const oldIndex = character.trackers.storyThemes.findIndex((tracker) => tracker.id === activeId);
			const newIndex = character.trackers.storyThemes.findIndex((tracker) => tracker.id === overId);
			if (oldIndex !== -1 && newIndex !== -1) reorderStoryThemes(oldIndex, newIndex);
		}
	}, [character, reorderStatuses, reorderStoryTags, reorderStoryThemes]);

	return { statusIds, storyTagIds, storyThemeIds, handleDragEnd };
}
