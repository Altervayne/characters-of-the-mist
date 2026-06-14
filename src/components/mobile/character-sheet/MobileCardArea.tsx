// -- React Imports --
import type { TouchEvent } from 'react';

// -- Component Imports --
import MobileCardCarousel from '@/components/mobile/character-sheet/MobileCardCarousel';

// -- Type Imports --
import type { Card } from '@/lib/types/character';



interface MobileCardAreaProps {
	cards: Card[];
	currentIndex: number;
	isLeftHanded: boolean;
	touchHandlers: { onTouchStart: (event: TouchEvent) => void; onTouchEnd: (event: TouchEvent) => void };
	onOpenAddCard?: () => void;
}

/**
 * Horizontal nudge that shifts the centred card toward the handedness-trailing
 * side so it clears the corner FAB, letting the FAB keep a single resting
 * position on every tab (instead of the old cards-only horizontal shift).
 *
 * The card is a fixed `w-62.5` (250px) centred inside the area's `p-3` (12px)
 * padding, so each side margin is `calc(50vw - 137px)` ((100vw - 24px - 250px) / 2).
 * The FAB rests at `left-4`/`right-4` (16px) and is 44px wide, so it needs roughly a
 * 64px gutter (16 + 44 + ~4 gap) on the leading side. The shift is the shortfall
 * between that gutter and the natural margin - `calc(201px - 50vw)` (64 + 137 - 50vw)
 * - clamped so it never exceeds `calc(50vw - 145px)` (the natural margin minus an 8px
 * minimum), which keeps the card on-screen on very narrow viewports. It collapses to
 * 0 once the natural margin already exceeds the gutter (~402px+), leaving wide
 * screens untouched.
 */
const FAB_CLEARANCE_SHIFT = 'max(0px, min(calc(201px - 50vw), calc(50vw - 145px)))';

/**
 * The scrollable card display area of the mobile character sheet, wrapping the
 * card carousel and carrying the card-area swipe handlers (horizontal swipe on
 * the card body navigates to the previous/next card) spread from the sheet's
 * gesture hook. The `data-tutorial` anchor is preserved.
 *
 * No FAB clearance *padding* is needed here: the displayed card is centred and
 * narrower than the viewport, and the card navigation bar below is an in-flow
 * sibling (which the FAB clears via {@link getFloatingBottom}'s card-nav-bar
 * allowance). The card is, however, nudged horizontally toward the trailing side
 * via {@link FAB_CLEARANCE_SHIFT} so the corner FAB clears the card's edge controls
 * without the FAB having to move - see that constant for the geometry.
 *
 * @param isLeftHanded - The FAB rests on this (leading) side, so the card is shifted the other way: right when true, left otherwise.
 */
export function MobileCardArea({ cards, currentIndex, isLeftHanded, touchHandlers, onOpenAddCard }: MobileCardAreaProps) {
	const transform = isLeftHanded
		? `translateX(${FAB_CLEARANCE_SHIFT})`
		: `translateX(calc(-1 * ${FAB_CLEARANCE_SHIFT}))`;

	return (
		<div
			className="flex-1 overflow-y-auto overflow-x-hidden p-3"
			data-tutorial="card-carousel"
			{...touchHandlers}
		>
			<div className="min-h-full flex items-center justify-center" style={{ transform }}>
				<MobileCardCarousel
					cards={cards}
					currentIndex={currentIndex}
					onOpenAddCard={onOpenAddCard}
				/>
			</div>
		</div>
	);
}
