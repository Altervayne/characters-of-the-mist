// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { LegendsThemeCard } from '@/components/organisms/LegendsThemeCard';
import { CityThemeCard } from '@/components/organisms/CityThemeCard';
import { OtherscapeThemeCard } from '@/components/organisms/OtherscapeThemeCard';
import { HeroCard } from '@/components/organisms/HeroCard';
import { RiftCard } from '@/components/organisms/RiftCard';
import { OtherscapeCharacterCard } from '@/components/organisms/OtherscapeCharacterCard';
import { AddCardButton } from '@/components/molecules/AddThemeCardButton';

// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { Card as CardData } from '@/lib/types/character';

interface MobileCardCarouselProps {
	cards: CardData[];
	currentIndex: number;
}

export default function MobileCardCarousel({ cards, currentIndex }: MobileCardCarouselProps) {
	const { t } = useTranslation();
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);

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

	// Simple card display (swipe gestures handled by parent MobileCharacterSheet)
	return (
		<div className="h-full w-full flex items-center justify-center">
			{renderCard(currentCard)}
		</div>
	);
}
