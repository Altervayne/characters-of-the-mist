// -- React Imports --
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Component Imports --
import { LegendsThemeCard } from '@/components/organisms/legends-theme-card';
import { CityThemeCard } from '@/components/organisms/city-theme-card';
import { OtherscapeThemeCard } from '@/components/organisms/otherscape-theme-card';
import { HeroCard } from '@/components/organisms/hero-card';
import { RiftCard } from '@/components/organisms/rift-card';
import { OtherscapeCharacterCard } from '@/components/organisms/otherscape-character-card';
import { AddCardButton } from '@/components/molecules/add-theme-card-button';

// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { PanInfo } from 'framer-motion';
import type { Card as CardData } from '@/lib/types/character';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileCardCarouselProps {
	cards: CardData[];
}

export default function MobileCardCarousel({ cards }: MobileCardCarouselProps) {
	const { t } = useTranslation();
	const [currentIndex, setCurrentIndex] = useState(0);
	const [direction, setDirection] = useState(0); // -1 for left, 1 for right
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);

	const totalCards = cards.length;

	// Navigate to specific card
	const goToCard = useCallback((index: number) => {
		if (index >= 0 && index < totalCards) {
			setDirection(index > currentIndex ? 1 : -1);
			setCurrentIndex(index);
		}
	}, [currentIndex, totalCards]);

	// Navigate to next card
	const goToNext = useCallback(() => {
		if (currentIndex < totalCards - 1) {
			setDirection(1);
			setCurrentIndex(currentIndex + 1);
		}
	}, [currentIndex, totalCards]);

	// Navigate to previous card
	const goToPrevious = useCallback(() => {
		if (currentIndex > 0) {
			setDirection(-1);
			setCurrentIndex(currentIndex - 1);
		}
	}, [currentIndex]);

	// Handle swipe gestures
	const handleDragEnd = useCallback(
		(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			const swipeThreshold = 50; // minimum distance to trigger swipe
			const { offset, velocity } = info;

			// If swiped fast enough or far enough
			if (Math.abs(velocity.x) > 500 || Math.abs(offset.x) > swipeThreshold) {
				if (offset.x > 0) {
					// Swiped right = go to previous
					goToPrevious();
				} else {
					// Swiped left = go to next
					goToNext();
				}
			}
		},
		[goToPrevious, goToNext]
	);

	// Render individual card based on type
	const renderCard = (card: CardData) => {
		const commonProps = {
			card,
			isEditing,
			isMobile: true,
			onEditCard: () => {}, // TODO: Implement in later phase
			onExport: () => {} // TODO: Implement in later phase
		};

		if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME' || card.cardType === 'LOADOUT_THEME') {
			if (card.details.game === 'LEGENDS') {
				return <LegendsThemeCard {...commonProps} />;
			} else if (card.details.game === 'CITY_OF_MIST') {
				return <CityThemeCard {...commonProps} />;
			} else if (card.details.game === 'OTHERSCAPE') {
				return <OtherscapeThemeCard {...commonProps} />;
			}
		}
		if (card.cardType === 'CHARACTER_CARD') {
			if (card.details.game === 'LEGENDS') {
				return <HeroCard {...commonProps} />;
			} else if (card.details.game === 'CITY_OF_MIST') {
				return <RiftCard {...commonProps} />;
			} else if (card.details.game === 'OTHERSCAPE') {
				return <OtherscapeCharacterCard {...commonProps} />;
			}
		}

		return (
			<div className="flex items-center justify-center h-full w-full bg-card border-2 border-border rounded-lg p-8">
				<p className="text-center text-muted-foreground">
					{`NO RENDER AVAILABLE FOR THIS TYPE: ${card.details.game} ${card.cardType}`}
				</p>
			</div>
		);
	};

	// Empty state
	if (totalCards === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center">
				<p className="text-lg text-muted-foreground mb-6">
					{t('MobileCardCarousel.noCards') || 'No cards yet'}
				</p>
				{isEditing && <AddCardButton onClick={() => {}} />}
			</div>
		);
	}

	// Framer Motion variants for slide animation
	const slideVariants = {
		enter: (direction: number) => ({
			x: direction > 0 ? '100%' : '-100%',
			opacity: 0
		}),
		center: {
			x: 0,
			opacity: 1
		},
		exit: (direction: number) => ({
			x: direction > 0 ? '-100%' : '100%',
			opacity: 0
		})
	};

	const currentCard = cards[currentIndex];

	return (
		<div className="relative h-full w-full bg-background">
			{/* Card Counter */}
			<div className="absolute top-4 right-4 z-10 px-3 py-1 bg-card/90 backdrop-blur-sm rounded-full border border-border">
				<span className="text-sm font-medium">
					{currentIndex + 1} / {totalCards}
				</span>
			</div>

			{/* Navigation Arrows (optional, for precision) */}
			{currentIndex > 0 && (
				<button
					onClick={goToPrevious}
					className={cn(
						"absolute left-2 top-1/2 -translate-y-1/2 z-10",
						"p-2 bg-card/90 backdrop-blur-sm rounded-full border border-border",
						"hover:bg-primary hover:text-primary-foreground transition-colors",
						"active:scale-95"
					)}
					aria-label="Previous card"
				>
					<ChevronLeft className="h-6 w-6" />
				</button>
			)}

			{currentIndex < totalCards - 1 && (
				<button
					onClick={goToNext}
					className={cn(
						"absolute right-2 top-1/2 -translate-y-1/2 z-10",
						"p-2 bg-card/90 backdrop-blur-sm rounded-full border border-border",
						"hover:bg-primary hover:text-primary-foreground transition-colors",
						"active:scale-95"
					)}
					aria-label="Next card"
				>
					<ChevronRight className="h-6 w-6" />
				</button>
			)}

			{/* Swipeable Card Container */}
			<div className="h-full w-full overflow-hidden">
				<AnimatePresence initial={false} custom={direction} mode="wait">
					<motion.div
						key={currentCard.id}
						custom={direction}
						variants={slideVariants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={{
							x: { type: 'spring', stiffness: 300, damping: 30 },
							opacity: { duration: 0.2 }
						}}
						drag="x"
						dragConstraints={{ left: 0, right: 0 }}
						dragElastic={0.2}
						onDragEnd={handleDragEnd}
						className="absolute inset-0 flex items-center justify-center p-4 cursor-grab active:cursor-grabbing"
					>
						{renderCard(currentCard)}
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Dot Indicators */}
			<div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
				{cards.map((card, index) => (
					<button
						key={card.id}
						onClick={() => goToCard(index)}
						className={cn(
							"h-2 rounded-full transition-all",
							index === currentIndex
								? "w-8 bg-primary"
								: "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
						)}
						aria-label={`Go to card ${index + 1}`}
					/>
				))}
			</div>
		</div>
	);
}
