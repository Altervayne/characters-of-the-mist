// -- React Imports --
import type { TouchEvent } from 'react';

// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Icon Imports --
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { deriveCardTitle } from '@/lib/utils/character';

// -- Type Imports --
import type { Card } from '@/lib/types/character';



interface MobileCardNavigationBarProps {
	cards: Card[];
	safeCardIndex: number;
	isLeftHanded: boolean;
	onPrevious: () => void;
	onNext: () => void;
	onSelectCard: (index: number) => void;
	onFlip: () => void;
	touchHandlers: { onTouchStart: (event: TouchEvent) => void; onTouchEnd: (event: TouchEvent) => void };
}

/**
 * The card navigation bar shown beneath the carousel in normal card view:
 * previous/next buttons, the current card's title (via the shared
 * `deriveCardTitle`), a row of dot indicators, and an explicit flip control.
 * Carries the nav-bar horizontal-navigate swipe handlers spread from the sheet's
 * gesture hook. Purely presentational; the `data-tutorial` anchor is preserved.
 *
 * Touch targets follow the ≥44px guideline: the prev/next arrows are 44px, and
 * each ~6px dot keeps its small visual but sits inside an invisible 44px hit area
 * (the dot row wraps when a character has enough cards to overflow one line). The
 * flip control is placed on the handedness-leading side (left for left-handed,
 * right otherwise) so it stays thumb-reachable while the prev/next steppers remain
 * at the outer edges. Flip toggles the current card's face via the sheet's
 * `onFlip`; note that for a card whose effective view mode is side-by-side this is
 * a visual no-op (both faces already show), matching the prior edge-swipe-flip
 * semantics.
 */
export function MobileCardNavigationBar({ cards, safeCardIndex, isLeftHanded, onPrevious, onNext, onSelectCard, onFlip, touchHandlers }: MobileCardNavigationBarProps) {
	const { t } = useTranslation();
	const areGestureHintsEnabled = useAppSettingsStore((state) => state.areGestureHintsEnabled);

	// The explicit flip control, placed on the handedness-leading side.
	const flipButton = (
		<IconButton
			variant="outline"
			size="sm"
			onClick={onFlip}
			aria-label={t('Toolbelt.flipCard')}
			className="h-11 w-11 shrink-0"
		>
			<RefreshCw className="h-5 w-5" />
		</IconButton>
	);

	return (
		<div
			className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-card border-t border-border"
			{...touchHandlers}
			data-tutorial="card-navigation-bar"
		>
			<IconButton
				variant="outline"
				size="sm"
				onClick={onPrevious}
				disabled={safeCardIndex === 0}
				aria-label="Previous card"
				className="h-11 w-11 shrink-0"
			>
				<ChevronLeft className="h-5 w-5" />
			</IconButton>

			{isLeftHanded && flipButton}

			<div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1">
				{/* Card Title */}
				<span className="text-xs font-medium truncate max-w-full text-center">
					{deriveCardTitle(cards[safeCardIndex], t)}
				</span>

				{/* Dot Indicators - small dot visual inside a 44px hit area */}
				<div className="flex flex-wrap items-center justify-center gap-0.5">
					{cards.map((_, index) => (
						<button
							key={index}
							onClick={() => onSelectCard(index)}
							className="flex h-11 w-11 shrink-0 items-center justify-center"
							aria-label={`Go to card ${index + 1}`}
						>
							<span
								className={cn(
									"h-1.5 rounded-full transition-all",
									index === safeCardIndex
										? "bg-primary w-4"
										: "bg-muted-foreground/30 w-1.5 hover:bg-muted-foreground/50"
								)}
							/>
						</button>
					))}
				</div>

				{/* Gesture tip: gated on the user's "gesture tips" setting, shown only
				    when navigation is possible. Unobtrusive and non-interactive. */}
				{areGestureHintsEnabled && cards.length > 1 && (
					<span className="text-[10px] leading-none text-muted-foreground/70 pointer-events-none">
						{t('MobileCardNavigationBar.swipeHint', { defaultValue: 'Swipe to navigate' })}
					</span>
				)}
			</div>

			{!isLeftHanded && flipButton}

			<IconButton
				variant="outline"
				size="sm"
				onClick={onNext}
				disabled={safeCardIndex === cards.length - 1}
				aria-label="Next card"
				className="h-11 w-11 shrink-0"
			>
				<ChevronRight className="h-5 w-5" />
			</IconButton>
		</div>
	);
}
