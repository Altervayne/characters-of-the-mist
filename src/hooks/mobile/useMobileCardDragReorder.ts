// -- React Imports --
import { useCallback, useMemo } from 'react';

// -- Other Library Imports --
import type { DragEndEvent } from '@dnd-kit/core';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Card } from '@/lib/types/character';



/**
 * Drives drag-to-reorder for the mobile card reorder list.
 *
 * Returns the memoized `cardIds` for the `SortableContext` and the @dnd-kit
 * `handleDragEnd` handler, which resolves the dragged card's old/new index
 * within the supplied list and dispatches `reorderCards`. Reordering is
 * index-based, so the caller passes the live `cards` array in display order. A
 * drop onto the same card, or one whose ids do not both resolve to an index, is
 * ignored.
 *
 * @param cards - The character's cards, in their displayed order.
 * @returns `{ cardIds, handleDragEnd }` to wire onto the reorder list's
 *   `<SortableContext>` and `<DndContext>`.
 */
export function useMobileCardDragReorder(cards: Card[]) {
	const { reorderCards } = useCharacterActions();

	const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);

	const handleDragEnd = useCallback((event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = cards.findIndex((card) => card.id === active.id);
		const newIndex = cards.findIndex((card) => card.id === over.id);
		if (oldIndex !== -1 && newIndex !== -1) reorderCards(oldIndex, newIndex);
	}, [cards, reorderCards]);

	return { cardIds, handleDragEnd };
}
