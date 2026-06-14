// -- React Imports --
import type { TouchEvent } from 'react';

// -- Component Imports --
import MobileCardCarousel from '@/components/mobile/character-sheet/MobileCardCarousel';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Card } from '@/lib/types/character';



interface MobileCardAreaProps {
	cards: Card[];
	currentIndex: number;
	isMobileFABMode: boolean;
	touchHandlers: { onTouchStart: (event: TouchEvent) => void; onTouchEnd: (event: TouchEvent) => void };
	onOpenAddCard?: () => void;
}

/**
 * The scrollable card display area of the mobile character sheet, wrapping the
 * card carousel and carrying the card-area swipe handlers (horizontal swipe on
 * the card body navigates to the previous/next card) spread from the sheet's
 * gesture hook. Purely presentational; the `data-tutorial` anchor is preserved.
 */
export function MobileCardArea({ cards, currentIndex, isMobileFABMode, touchHandlers, onOpenAddCard }: MobileCardAreaProps) {
	return (
		<div
			className={cn("flex-1 overflow-y-auto overflow-x-hidden p-4", isMobileFABMode && "pb-32")}
			data-tutorial="card-carousel"
			{...touchHandlers}
		>
			<div className="min-h-full flex items-center justify-center">
				<MobileCardCarousel
					cards={cards}
					currentIndex={currentIndex}
					onOpenAddCard={onOpenAddCard}
				/>
			</div>
		</div>
	);
}
