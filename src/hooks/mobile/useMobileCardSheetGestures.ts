// -- React Imports --
import { useRef, type TouchEvent, type Dispatch, type SetStateAction } from 'react';

// -- Type Imports --
import type { Character } from '@/lib/types/character';



interface UseMobileCardSheetGesturesParameters {
	character: Character | null;
	safeCardIndex: number;
	isLeftHanded: boolean;
	isMobileFABMode: boolean;
	isToolbeltOpen: boolean;
	flipCard: (cardId: string) => void;
	setCurrentCardIndex: Dispatch<SetStateAction<number>>;
	setIsReorderingCards: (value: boolean) => void;
	setIsToolbeltOpen: (value: boolean) => void;
}

/**
 * Owns the mobile character sheet's three touch-swipe surfaces and returns the
 * touch handlers to spread onto each.
 *
 * - **Card area:** a horizontal edge-swipe flips the current card or opens the
 *   toolbelt, branching on handedness and FAB-vs-side-panel mode (in FAB mode the
 *   would-be toolbelt edge flips instead, since the toolbelt is reached via the FAB).
 * - **Nav bar:** a vertical swipe-up enters card-reorder mode; a horizontal swipe
 *   navigates to the previous/next card.
 * - **Trackers area:** a horizontal edge-swipe opens the toolbelt (side-panel mode
 *   only), branching on handedness.
 *
 * The edge thresholds, the `window.innerWidth` reads, and every handedness /
 * FAB-mode / `isToolbeltOpen` branch are preserved exactly; only the card index,
 * reorder flag, toolbelt flag, and `flipCard` action are supplied by the caller
 * (the card index stays owned by the component, which the nav bar dots/buttons and
 * carousel also read).
 *
 * @returns Per-surface `{ onTouchStart, onTouchEnd }` objects to spread onto the
 *   card area, nav bar, and trackers area elements.
 */
export function useMobileCardSheetGestures({
	character,
	safeCardIndex,
	isLeftHanded,
	isMobileFABMode,
	isToolbeltOpen,
	flipCard,
	setCurrentCardIndex,
	setIsReorderingCards,
	setIsToolbeltOpen,
}: UseMobileCardSheetGesturesParameters) {
	// Swipe gesture detection for card area (edge swipes for flip/toolbelt)
	const cardSwipeStartX = useRef<number>(0);
	const cardSwipeStartY = useRef<number>(0);

	const handleCardAreaTouchStart = (e: TouchEvent) => {
		cardSwipeStartX.current = e.touches[0].clientX;
		cardSwipeStartY.current = e.touches[0].clientY;
	};

	// Swipe gesture detection for navigation bar (card navigation)
	const navSwipeStartX = useRef<number>(0);
	const navSwipeStartY = useRef<number>(0);

	const handleNavBarTouchStart = (e: TouchEvent) => {
		navSwipeStartX.current = e.touches[0].clientX;
		navSwipeStartY.current = e.touches[0].clientY;
	};

	const handleNavBarTouchEnd = (e: TouchEvent) => {
		if (!character || character.cards.length === 0) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - navSwipeStartX.current;
		const deltaY = touchEndY - navSwipeStartY.current;

		// Check for vertical swipe up (negative deltaY) to enter reorder mode
		if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -50) {
			setIsReorderingCards(true);
			return;
		}

		// Only process horizontal swipes with 50px threshold
		if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 50) return;

		// Swipe left = next card
		if (deltaX < 0 && safeCardIndex < character.cards.length - 1) {
			setCurrentCardIndex(i => i + 1);
		}
		// Swipe right = previous card
		else if (deltaX > 0 && safeCardIndex > 0) {
			setCurrentCardIndex(i => i - 1);
		}
	};

	const handleCardAreaTouchEnd = (e: TouchEvent) => {
		if (!character || character.cards.length === 0) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - cardSwipeStartX.current;
		const deltaY = touchEndY - cardSwipeStartY.current;

		// Only process horizontal swipes
		if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 30) return;

		const currentCard = character.cards[safeCardIndex];
		const edgeThreshold = 50;
		const swipeThreshold = 30;

		// Edge swipe behavior depends on handedness setting
		if (isLeftHanded) {
			// Left-handed mode: Right edge = flip, Left edge = toolbelt
			if (cardSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
				// Right edge swipe → Flip card
				flipCard(currentCard.id);
			}
			else if (cardSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				// Left edge swipe → Open toolbelt (side-panel mode only)
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				} else if (isMobileFABMode) {
					// FAB mode: Flip card (toolbelt is accessible via FAB)
					flipCard(currentCard.id);
				}
			}
		} else {
			// Right-handed mode (default): Left edge = flip, Right edge = toolbelt
			if (cardSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				// Left edge swipe → Flip card
				flipCard(currentCard.id);
			}
			else if (cardSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
				// Right edge swipe → Open toolbelt (side-panel mode only)
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				} else if (isMobileFABMode) {
					// FAB mode: Flip card (toolbelt is accessible via FAB)
					flipCard(currentCard.id);
				}
			}
		}
	};

	// Swipe gesture detection for trackers area (edge swipe for toolbelt)
	const trackersSwipeStartX = useRef<number>(0);
	const trackersSwipeStartY = useRef<number>(0);

	const handleTrackersAreaTouchStart = (e: TouchEvent) => {
		trackersSwipeStartX.current = e.touches[0].clientX;
		trackersSwipeStartY.current = e.touches[0].clientY;
	};

	const handleTrackersAreaTouchEnd = (e: TouchEvent) => {
		if (!character) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - trackersSwipeStartX.current;
		const deltaY = touchEndY - trackersSwipeStartY.current;

		// Only process horizontal swipes
		if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 30) return;

		const edgeThreshold = 50;
		const swipeThreshold = 30;

		// Edge swipe behavior depends on handedness setting (only in side-panel mode)
		if (isLeftHanded) {
			// Left-handed mode: Left edge → Open toolbelt
			if (trackersSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				}
			}
		} else {
			// Right-handed mode: Right edge → Open toolbelt
			if (trackersSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				}
			}
		}
	};

	return {
		cardAreaHandlers: { onTouchStart: handleCardAreaTouchStart, onTouchEnd: handleCardAreaTouchEnd },
		navBarHandlers: { onTouchStart: handleNavBarTouchStart, onTouchEnd: handleNavBarTouchEnd },
		trackersAreaHandlers: { onTouchStart: handleTrackersAreaTouchStart, onTouchEnd: handleTrackersAreaTouchEnd },
	};
}
