// -- React Imports --
import type { TouchEvent } from 'react';

// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { ChevronLeft, ChevronRight } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { deriveCardTitle } from '@/lib/utils/character';

// -- Type Imports --
import type { Card } from '@/lib/types/character';



interface MobileCardNavigationBarProps {
	cards: Card[];
	safeCardIndex: number;
	onPrevious: () => void;
	onNext: () => void;
	onSelectCard: (index: number) => void;
	touchHandlers: { onTouchStart: (event: TouchEvent) => void; onTouchEnd: (event: TouchEvent) => void };
}

/**
 * The card navigation bar shown beneath the carousel in normal card view:
 * previous/next buttons, the current card's title (via the shared
 * `deriveCardTitle`), and a row of dot indicators. Carries the nav-bar swipe
 * handlers (horizontal navigate, swipe-up to reorder) spread from the sheet's
 * gesture hook. Purely presentational; the `data-tutorial` anchor is preserved.
 */
export function MobileCardNavigationBar({ cards, safeCardIndex, onPrevious, onNext, onSelectCard, touchHandlers }: MobileCardNavigationBarProps) {
	const { t } = useTranslation();

	return (
		<div
			className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-card border-t border-border"
			{...touchHandlers}
			data-tutorial="card-navigation-bar"
		>
			<IconButton
				variant="outline"
				size="sm"
				onClick={onPrevious}
				disabled={safeCardIndex === 0}
				aria-label="Previous card"
				className="h-8 w-8"
			>
				<ChevronLeft className="h-4 w-4" />
			</IconButton>

			<div className="flex-1 flex flex-col items-center justify-center gap-1">
				{/* Card Title */}
				<span className="text-xs font-medium truncate max-w-full text-center">
					{deriveCardTitle(cards[safeCardIndex], t)}
				</span>

				{/* Dot Indicators */}
				<div className="flex items-center gap-1">
					{cards.map((_, index) => (
						<button
							key={index}
							onClick={() => onSelectCard(index)}
							className={cn(
								"h-1.5 w-1.5 rounded-full transition-all",
								index === safeCardIndex
									? "bg-primary w-4"
									: "bg-muted-foreground/30 hover:bg-muted-foreground/50"
							)}
							aria-label={`Go to card ${index + 1}`}
						/>
					))}
				</div>
			</div>

			<IconButton
				variant="outline"
				size="sm"
				onClick={onNext}
				disabled={safeCardIndex === cards.length - 1}
				aria-label="Next card"
				className="h-8 w-8"
			>
				<ChevronRight className="h-4 w-4" />
			</IconButton>
		</div>
	);
}
