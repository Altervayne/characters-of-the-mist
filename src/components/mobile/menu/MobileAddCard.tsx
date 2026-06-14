// -- React Imports --
import { useState, useMemo, useEffect, startTransition } from 'react';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { MobileAddCardStartingTags } from '@/components/mobile/menu/MobileAddCardStartingTags';
import { MobileAddCardTypeSelector } from '@/components/mobile/menu/MobileAddCardTypeSelector';
import { MobileAddCardThemeTypeSelector } from '@/components/mobile/menu/MobileAddCardThemeTypeSelector';
import { MobileAddCardThemebookPicker } from '@/components/mobile/menu/MobileAddCardThemebookPicker';

// -- Icon Imports --
import { ChevronLeft } from 'lucide-react';

// -- Utils Imports --
import { legendsThemeTypes, legendsThemebooks } from '@/lib/data/legendsData';
import { cityThemeTypes, cityThemebooks } from '@/lib/data/cityData';
import { otherscapeThemeTypes, otherscapeThemebooks } from '@/lib/data/otherscapeData';

// -- Type Imports --
import type { Card as CardData, LegendsThemeDetails, CityThemeDetails, OtherscapeThemeDetails } from '@/lib/types/character';
import type { CreateCardOptions, ThemeTypeUnion } from '@/lib/types/creation';
import type { GameSystem } from '@/lib/types/drawer';

type CardTypeSelection = 'CHARACTER_THEME' | 'GROUP_THEME' | 'LOADOUT_THEME';

interface MobileAddCardProps {
	onBack: () => void;
	onConfirm: (options: CreateCardOptions, cardId?: string) => void;
	mode: 'create' | 'edit';
	cardData?: CardData;
	game: GameSystem;
}

export default function MobileAddCard({ onBack, onConfirm, mode, cardData, game }: MobileAddCardProps) {
	const { t } = useTranslation();
	const { t: tTheme } = useTranslation();

	const [cardType, setCardType] = useState<CardTypeSelection | ''>('');
	const [themeType, setThemeType] = useState<ThemeTypeUnion>(
		game === 'LEGENDS' ? 'Origin' : game === 'OTHERSCAPE' ? 'Mythos' : 'Mythos'
	);
	const [themebook, setThemebook] = useState('');
	const [powerTagsCount, setPowerTagsCount] = useState(2);
	const [weaknessTagsCount, setWeaknessTagsCount] = useState(1);
	const [wildcardSlots, setWildcardSlots] = useState(0);
	const [searchQuery, setSearchQuery] = useState('');

	// Get the appropriate theme types based on game
	const themeTypes = game === 'LEGENDS' ? legendsThemeTypes : game === 'OTHERSCAPE' ? otherscapeThemeTypes : cityThemeTypes;

	const availableThemebooks = useMemo(() => {
		if (!themeType) return [];

		if (game === 'LEGENDS' && (themeType === 'Origin' || themeType === 'Adventure' || themeType === 'Greatness')) {
			return legendsThemebooks[themeType];
		} else if (game === 'CITY_OF_MIST' && (themeType === 'Mythos' || themeType === 'Logos')) {
			return cityThemebooks[themeType];
		} else if (game === 'OTHERSCAPE' && (themeType === 'Mythos' || themeType === 'Self' || themeType === 'Noise')) {
			return otherscapeThemebooks[themeType];
		}
		return [];
	}, [themeType, game]);

	// Filter themebooks based on search query
	const filteredThemebooks = useMemo(() => {
		if (!searchQuery.trim()) return availableThemebooks;

		const query = searchQuery.toLowerCase();
		return availableThemebooks.filter(book =>
			tTheme(book.key as string).toLowerCase().includes(query) ||
			book.value.toLowerCase().includes(query)
		);
	}, [availableThemebooks, searchQuery, tTheme]);


	useEffect(() => {
		if (mode === 'edit' && cardData) {
			startTransition(() => {
				if (game === 'LEGENDS') {
					const details = cardData.details as LegendsThemeDetails;
					setCardType(cardData.cardType as CardTypeSelection);
					setThemeType(details.themeType);
					setThemebook(details.themebook);
					setPowerTagsCount(details.powerTags.length);
					setWeaknessTagsCount(details.weaknessTags.length);
				} else if (game === 'CITY_OF_MIST') {
					const details = cardData.details as CityThemeDetails;
					setCardType(cardData.cardType as CardTypeSelection);
					setThemeType(details.themeType);
					setThemebook(details.themebook);
					setPowerTagsCount(details.powerTags.length);
					setWeaknessTagsCount(details.weaknessTags.length);
				} else if (game === 'OTHERSCAPE') {
					const details = cardData.details as OtherscapeThemeDetails;
					setCardType(cardData.cardType as CardTypeSelection);
					setThemeType(details.themeType);
					setThemebook(details.themebook);
					setPowerTagsCount(details.powerTags.length);
					setWeaknessTagsCount(details.weaknessTags.length);
				}
			});
		} else {
			startTransition(() => {
				setCardType('');
				setThemeType(game === 'LEGENDS' ? 'Origin' : game === 'OTHERSCAPE' ? 'Mythos' : 'Mythos');
				setThemebook('');
			});
		}
	}, [mode, cardData, game]);

	const handleConfirm = () => {
		if (cardType) {
			onConfirm(
				{ cardType, themebook: themebook?.trim(), themeType, powerTagsCount, weaknessTagsCount, wildcardSlots },
				mode === 'edit' ? cardData?.id : undefined
			);
			onBack();
		}
	};

	const handleThemeTypeChange = (value: string) => {
		if (game === 'LEGENDS') {
			if (value === 'Origin' || value === 'Adventure' || value === 'Greatness') {
				setThemeType(value);
				setThemebook('');
				setSearchQuery('');
			}
		} else if (game === 'CITY_OF_MIST') {
			if (value === 'Mythos' || value === 'Logos') {
				setThemeType(value);
				setThemebook('');
				setSearchQuery('');
			}
		} else if (game === 'OTHERSCAPE') {
			if (value === 'Mythos' || value === 'Self' || value === 'Noise') {
				setThemeType(value);
				setThemebook('');
				setSearchQuery('');
			}
		}
	};

	const isConfirmDisabled = !cardType ||
		(cardType === 'CHARACTER_THEME' && !themebook.trim()) ||
		(cardType === 'CHARACTER_THEME' && !themeType);

	return (
		<div className="h-full w-full flex flex-col">
			{/* Header */}
			<header className="shrink-0 p-4 bg-popover border-b border-border flex items-center gap-3">
				<IconButton
					variant="ghost"
					size="sm"
					onClick={onBack}
					aria-label={t('Common.back')}
					className="h-8 w-8"
				>
					<ChevronLeft className="h-5 w-5" />
				</IconButton>
				<h1 className="text-xl font-bold">
					{mode === 'create' ? t('CreateCardDialog.title') : t('CreateCardDialog.editTitle')}
				</h1>
			</header>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-6 pb-32">
				<div className="max-w-2xl mx-auto space-y-6">
					{/* Card Type Selection */}
					<MobileAddCardTypeSelector
						game={game}
						mode={mode}
						cardType={cardType}
						onSelect={setCardType}
					/>

					{/* Theme Type & Themebook (only for CHARACTER_THEME) */}
					{cardType === 'CHARACTER_THEME' && (
						<>
							{/* Theme Type Selection */}
							<MobileAddCardThemeTypeSelector
								themeTypes={themeTypes}
								themeType={themeType}
								onChange={handleThemeTypeChange}
							/>

							{/* Themebook Selection */}
							<MobileAddCardThemebookPicker
								searchQuery={searchQuery}
								setSearchQuery={setSearchQuery}
								filteredThemebooks={filteredThemebooks}
								themeType={themeType}
								themebook={themebook}
								onSelect={(book) => {
									setThemebook(book.value);
									setSearchQuery('');
								}}
							/>
						</>
					)}

					{/* Starting Tags (only in create mode) */}
					{mode === 'create' && cardType && (
						<MobileAddCardStartingTags
							cardType={cardType}
							powerTagsCount={powerTagsCount}
							setPowerTagsCount={setPowerTagsCount}
							weaknessTagsCount={weaknessTagsCount}
							setWeaknessTagsCount={setWeaknessTagsCount}
							wildcardSlots={wildcardSlots}
							setWildcardSlots={setWildcardSlots}
						/>
					)}
				</div>
			</div>

			{/* Footer with Confirm Button */}
			<div className="shrink-0 p-4 bg-card border-t border-border">
				<Button
					onClick={handleConfirm}
					disabled={isConfirmDisabled}
					className="w-full h-12 text-base"
				>
					{mode === 'create' ? t('CreateCardDialog.createButton') : t('CreateCardDialog.updateButton')}
				</Button>
			</div>
		</div>
	);
}
