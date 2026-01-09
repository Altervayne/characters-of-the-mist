// -- React Imports --
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { ChevronLeft, Check } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
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
	const { t: tTypes } = useTranslation();
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
		} else {
			setCardType('');
			setThemeType(game === 'LEGENDS' ? 'Origin' : game === 'OTHERSCAPE' ? 'Mythos' : 'Mythos');
			setThemebook('');
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
					aria-label="Back"
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
					<div className="space-y-2">
						<Label className="text-sm font-semibold">{t('CreateCardDialog.cardTypeLabel')}</Label>
						<div className="grid grid-cols-1 gap-2">
							<Button
								variant={cardType === 'CHARACTER_THEME' ? 'default' : 'outline'}
								onClick={() => setCardType('CHARACTER_THEME')}
								disabled={mode === 'edit'}
								className="h-auto min-h-12 text-base justify-start"
							>
								{game === 'LEGENDS' ? t('CreateCardDialog.themeCard') : game === 'OTHERSCAPE' ? t('CreateCardDialog.otherscapeThemeCard') : t('CreateCardDialog.riftThemeCard')}
							</Button>

							{(game === 'LEGENDS' || game === 'CITY_OF_MIST' || game === 'OTHERSCAPE') && (
								<Button
									variant={cardType === 'GROUP_THEME' ? 'default' : 'outline'}
									onClick={() => setCardType('GROUP_THEME')}
									disabled={mode === 'edit'}
									className="h-auto min-h-12 text-base justify-start"
								>
									{game === 'LEGENDS' ? t('CreateCardDialog.fellowshipCard') : game === 'OTHERSCAPE' ? t('CreateCardDialog.otherscapeCrewCard') : t('CreateCardDialog.crewCard')}
								</Button>
							)}

							{game === 'OTHERSCAPE' && (
								<Button
									variant={cardType === 'LOADOUT_THEME' ? 'default' : 'outline'}
									onClick={() => setCardType('LOADOUT_THEME')}
									disabled={mode === 'edit'}
									className="h-auto min-h-12 text-base justify-start"
								>
									{t('CreateCardDialog.otherscapeLoadoutCard')}
								</Button>
							)}
						</div>
					</div>

					{/* Theme Type & Themebook (only for CHARACTER_THEME) */}
					{cardType === 'CHARACTER_THEME' && (
						<>
							{/* Theme Type Selection */}
							<div className="space-y-2">
								<Label className="text-sm font-semibold">{t('CreateCardDialog.themeTypeLabel')}</Label>
								<div className="grid grid-cols-1 gap-2">
									{themeTypes.map(type => (
										<Button
											key={type}
											variant={themeType === type ? 'default' : 'outline'}
											onClick={() => handleThemeTypeChange(type)}
											className="h-auto min-h-12 text-base justify-start"
										>
											{tTypes(type)}
										</Button>
									))}
								</div>
							</div>

							{/* Themebook Selection */}
							<div className="space-y-2">
								<Label className="text-sm font-semibold">{t('CreateCardDialog.themebookLabel')}</Label>

								{/* Search Input */}
								<Input
									type="text"
									placeholder={t('CreateCardDialog.searchThemebookPlaceholder')}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									disabled={!themeType}
									className="text-base"
								/>

								{/* Themebook List */}
								{themeType && (
									<div className="max-h-64 overflow-y-auto border border-border rounded-md">
										{filteredThemebooks.length > 0 ? (
											filteredThemebooks.map((book) => (
												<button
													key={book.value}
													onClick={() => {
														setThemebook(book.value);
														setSearchQuery('');
													}}
													className={cn(
														"w-full px-4 py-3 text-left text-base transition-colors flex items-center gap-3",
														themebook.toLowerCase() === book.value.toLowerCase()
															? "bg-primary text-primary-foreground"
															: "hover:bg-muted"
													)}
												>
													<Check
														className={cn(
															"h-5 w-5 shrink-0",
															themebook.toLowerCase() === book.value.toLowerCase() ? "opacity-100" : "opacity-0"
														)}
													/>
													<span>{tTheme(book.key as string)}</span>
												</button>
											))
										) : (
											<div className="px-4 py-8 text-center text-muted-foreground">
												{t('CreateCardDialog.noThemebookFound')}
											</div>
										)}
									</div>
								)}
							</div>
						</>
					)}

					{/* Starting Tags (only in create mode) */}
					{mode === 'create' && cardType && (
						<>
							<div className="pt-4">
								<h3 className="text-sm font-semibold mb-4">{t("CreateCardDialog.startingTagsLabel")}</h3>
								<div className="space-y-4">
									{/* Power/Gear Tags */}
									<div className="space-y-2">
										<Label htmlFor="power-tags" className="text-sm">
											{cardType === 'LOADOUT_THEME' ? t('CreateCardDialog.gearTagCountLabel') : t('CreateCardDialog.powerTagCountLabel')}
										</Label>
										<Input
											id="power-tags"
											type="number"
											min={0}
											value={powerTagsCount}
											onChange={e => setPowerTagsCount(Number(e.target.value))}
											className="text-base"
										/>
									</div>

									{/* Weakness/Flaw Tags */}
									<div className="space-y-2">
										<Label htmlFor="weakness-tags" className="text-sm">
											{cardType === 'LOADOUT_THEME' ? t('CreateCardDialog.flawTagCountLabel') : t('CreateCardDialog.weaknessTagCountLabel')}
										</Label>
										<Input
											id="weakness-tags"
											type="number"
											min={0}
											value={weaknessTagsCount}
											onChange={e => setWeaknessTagsCount(Number(e.target.value))}
											className="text-base"
										/>
									</div>

									{/* Wildcard Slots (only for LOADOUT_THEME) */}
									{cardType === 'LOADOUT_THEME' && (
										<div className="space-y-2">
											<Label htmlFor="wildcard-slots" className="text-sm">
												{t('CreateCardDialog.wildcardSlotsLabel')}
											</Label>
											<Input
												id="wildcard-slots"
												type="number"
												min={0}
												value={wildcardSlots}
												onChange={e => setWildcardSlots(Number(e.target.value))}
												className="text-base"
											/>
										</div>
									)}
								</div>
							</div>
						</>
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
