// -- React Imports --
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

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
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Card as CardData } from '@/lib/types/character';

interface MobileCardCarouselProps {
	cards: CardData[];
	currentIndex: number;
}

export default function MobileCardCarousel({ cards, currentIndex }: MobileCardCarouselProps) {
	const { t } = useTranslation();
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const { flipCard } = useCharacterActions();

	// Swipe gesture detection for flipping cards
	const touchStartX = useRef<number>(0);
	const touchStartY = useRef<number>(0);

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
		touchStartY.current = e.touches[0].clientY;
	};

	const handleTouchEnd = (e: React.TouchEvent, cardId: string) => {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;

		const deltaX = touchEndX - touchStartX.current;
		const deltaY = touchEndY - touchStartY.current;

		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 100) {
			if (deltaX !== 0) {
				flipCard(cardId);
			}
		}
	};

	// Render individual card based on type
	const renderCard = (card: CardData) => {
		const commonProps = {
			card,
			isEditing,
			useVerticalStack: true,
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
	if (cards.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center">
				<p className="text-lg text-muted-foreground mb-6">
					{t('MobileCardCarousel.noCards') || 'No cards yet'}
				</p>
				{isEditing && <AddCardButton onClick={() => {}} />}
			</div>
		);
	}

	const currentCard = cards[currentIndex];

	// Wrap card with swipe gesture for flipping
	return (
		<div
			onTouchStart={handleTouchStart}
			onTouchEnd={(e) => handleTouchEnd(e, currentCard.id)}
			className="h-full w-full flex items-center justify-center"
		>
			{renderCard(currentCard)}
		</div>
	);
}
