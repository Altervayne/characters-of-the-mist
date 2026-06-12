// -- React Imports --
import { useState, useMemo } from 'react';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Character } from '@/lib/types/character';



/**
 * Drives the mobile character sheet's button-based tracker reordering.
 *
 * Given the currently-selected tracker and the character, exposes `moveTrackerUp`
 * / `moveTrackerDown` (which locate the tracker across statuses, story tags, and
 * story themes and dispatch the matching reorder store action) plus
 * `canMoveTrackerUp` / `canMoveTrackerDown` for the up/down buttons' disabled
 * state. An internal `isReorderingTracker` flag guards against double-firing while
 * a reorder settles, cleared on a short `setTimeout`; it is not exposed because
 * only the move handlers need it.
 *
 * @param selectedTrackerId - The id of the tracker currently selected for reordering, or null.
 * @param character - The loaded character (or null), source of the tracker lists.
 * @returns The two move handlers and the two can-move flags.
 */
export function useMobileTrackerReorder(selectedTrackerId: string | null, character: Character | null) {
	const { reorderStatuses, reorderStoryTags, reorderStoryThemes } = useCharacterActions();
	const [isReorderingTracker, setIsReorderingTracker] = useState(false);

	const moveTrackerUp = () => {
		if (!selectedTrackerId || !character || isReorderingTracker) return;

		setIsReorderingTracker(true);

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex > 0) {
			reorderStatuses(statusIndex, statusIndex - 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex > 0) {
			reorderStoryTags(tagIndex, tagIndex - 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		if (themeIndex > 0) {
			reorderStoryThemes(themeIndex, themeIndex - 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
		} else {
			setIsReorderingTracker(false);
		}
	};

	const moveTrackerDown = () => {
		if (!selectedTrackerId || !character || isReorderingTracker) return;

		setIsReorderingTracker(true);

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex !== -1 && statusIndex < character.trackers.statuses.length - 1) {
			reorderStatuses(statusIndex, statusIndex + 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex !== -1 && tagIndex < character.trackers.storyTags.length - 1) {
			reorderStoryTags(tagIndex, tagIndex + 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		if (themeIndex !== -1 && themeIndex < character.trackers.storyThemes.length - 1) {
			reorderStoryThemes(themeIndex, themeIndex + 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
		} else {
			setIsReorderingTracker(false);
		}
	};

	const canMoveTrackerUp = useMemo(() => {
		if (!selectedTrackerId || !character) return false;

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex > 0) return true;

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex > 0) return true;

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		return themeIndex > 0;
	}, [selectedTrackerId, character]);

	const canMoveTrackerDown = useMemo(() => {
		if (!selectedTrackerId || !character) return false;

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex !== -1 && statusIndex < character.trackers.statuses.length - 1) return true;

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex !== -1 && tagIndex < character.trackers.storyTags.length - 1) return true;

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		return themeIndex !== -1 && themeIndex < character.trackers.storyThemes.length - 1;
	}, [selectedTrackerId, character]);

	return { moveTrackerUp, moveTrackerDown, canMoveTrackerUp, canMoveTrackerDown };
}
