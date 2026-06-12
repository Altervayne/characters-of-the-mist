// -- React Imports --
import { useState } from 'react';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Character } from '@/lib/types/character';



/**
 * Drives the mobile character sheet's button-based card reordering.
 *
 * Exposes `moveCardUp(index)` / `moveCardDown(index)`, which dispatch the
 * `reorderCards` store action after bounds-checking the index against the
 * character's card list. The `isReorderingCard` flag guards against double-firing
 * while a reorder settles (cleared on a short `setTimeout`) and is returned so the
 * reorder buttons can disable themselves mid-move.
 *
 * @param character - The loaded character (or null), source of the card list bounds.
 * @returns `isReorderingCard` for the buttons' disabled state and the two move handlers.
 */
export function useMobileCardReorder(character: Character | null) {
	const { reorderCards } = useCharacterActions();
	const [isReorderingCard, setIsReorderingCard] = useState(false);

	const moveCardUp = (cardIndex: number) => {
		if (cardIndex <= 0 || !character || isReorderingCard) return;
		setIsReorderingCard(true);
		reorderCards(cardIndex, cardIndex - 1);
		setTimeout(() => setIsReorderingCard(false), 100);
	};

	const moveCardDown = (cardIndex: number) => {
		if (!character || cardIndex >= character.cards.length - 1 || isReorderingCard) return;
		setIsReorderingCard(true);
		reorderCards(cardIndex, cardIndex + 1);
		setTimeout(() => setIsReorderingCard(false), 100);
	};

	return { isReorderingCard, moveCardUp, moveCardDown };
}
