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
	setCurrentCardIndex: Dispatch<SetStateAction<number>>;
	setIsToolbeltOpen: (value: boolean) => void;
}

// A swipe must be clearly horizontal to count as card navigation: its horizontal
// travel must dominate its vertical travel (G3), so a diagonal scroll of the
// card area never steps the card. It must also clear a minimum distance.
const NAVIGATE_HORIZONTAL_DOMINANCE = 1.5;
const NAVIGATE_MIN_DISTANCE = 50;

/**
 * Owns the mobile character sheet's three touch-swipe surfaces and returns the
 * touch handlers to spread onto each.
 *
 * - **Card area:** a horizontal swipe anywhere on the card body navigates to the
 *   previous/next card (same logic as the nav bar). Card flip is now an explicit
 *   nav-bar button, so the former edge-swipe-flip is retired; the former
 *   side-panel edge-swipe-toolbelt is also retired here in favour of the tab-bar
 *   toolbelt button, so the card body navigates uniformly with no edge zones.
 * - **Nav bar:** a horizontal swipe navigates to the previous/next card. (Card
 *   reorder is entered via the toolbelt's reorder action and performed by
 *   drag-to-reorder, so the former swipe-up-to-reorder gesture is retired.)
 * - **Trackers area:** a horizontal edge-swipe opens the toolbelt (side-panel mode
 *   only), branching on handedness.
 *
 * Both navigate-swipe surfaces share one rule (horizontal-dominance + minimum
 * distance) via {@link navigateFromHorizontalSwipe}. The trackers area's edge
 * thresholds, `window.innerWidth` read, and handedness / FAB-mode / `isToolbeltOpen`
 * branches are preserved exactly; the card index stays owned by the component,
 * which the nav bar dots/buttons and carousel also read.
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
	setCurrentCardIndex,
	setIsToolbeltOpen,
}: UseMobileCardSheetGesturesParameters) {
	// Shared prev/next navigation for the card-area and nav-bar swipes. Steps one
	// card on a clearly-horizontal swipe (G3 dominance + minimum distance),
	// clamped to the card-list bounds.
	const navigateFromHorizontalSwipe = (deltaX: number, deltaY: number) => {
		if (!character || character.cards.length === 0) return;

		// Require horizontal dominance so diagonal/vertical scrolls do not navigate.
		if (Math.abs(deltaX) < NAVIGATE_HORIZONTAL_DOMINANCE * Math.abs(deltaY)) return;
		if (Math.abs(deltaX) < NAVIGATE_MIN_DISTANCE) return;

		// Swipe left = next card; swipe right = previous card.
		if (deltaX < 0 && safeCardIndex < character.cards.length - 1) {
			setCurrentCardIndex(i => i + 1);
		} else if (deltaX > 0 && safeCardIndex > 0) {
			setCurrentCardIndex(i => i - 1);
		}
	};

	// Swipe gesture detection for card area (horizontal swipe navigates prev/next)
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
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		navigateFromHorizontalSwipe(touchEndX - navSwipeStartX.current, touchEndY - navSwipeStartY.current);
	};

	const handleCardAreaTouchEnd = (e: TouchEvent) => {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		navigateFromHorizontalSwipe(touchEndX - cardSwipeStartX.current, touchEndY - cardSwipeStartY.current);
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
			// Left-handed mode: Left edge opens the toolbelt
			if (trackersSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				}
			}
		} else {
			// Right-handed mode: Right edge opens the toolbelt
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
