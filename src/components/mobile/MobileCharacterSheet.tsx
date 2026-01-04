// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/molecules/status-tracker';
import { StoryTagTrackerCard } from '@/components/molecules/story-tag-tracker';
import { StoryThemeTrackerCard } from '@/components/organisms/story-theme-tracker';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import MobileCardCarousel from './MobileCardCarousel';

// -- Icon Imports --
import { ChevronLeft, ChevronRight } from 'lucide-react';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Card, CardDetails } from '@/lib/types/character';



type SheetTab = 'trackers' | 'cards';

// Type guards for card details
function hasCharacterName(details: CardDetails): details is { characterName: string } & CardDetails {
	return 'characterName' in details;
}

function hasThemebook(details: CardDetails): details is { themebook: string } & CardDetails {
	return 'themebook' in details;
}

function hasMainTag(details: CardDetails): details is { mainTag: { name: string } } & CardDetails {
	return 'mainTag' in details && details.mainTag !== null;
}



export default function MobileCharacterSheet() {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<SheetTab>('trackers');

	// Character data
	const character = useCharacterStore((state) => state.character);
	const { updateCharacterName, addStatus, addStoryTag } = useCharacterActions();

	// Settings
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const isTrackersAlwaysEditable = useAppSettingsStore((state) => state.isTrackersAlwaysEditable);
	const areTrackersEditable = isEditing || isTrackersAlwaysEditable;

	// Card navigation state
	const [currentCardIndex, setCurrentCardIndex] = useState(0);

	// Character name input with debouncing
	const [localName, setLocalName] = useInputDebouncer(
		character?.name || '',
		(value) => updateCharacterName(value)
	);

	// Safe card index (clamp to valid range)
	const safeCardIndex = character && character.cards.length > 0
		? Math.min(currentCardIndex, character.cards.length - 1)
		: 0;

	// Helper function to get card display name
	const getCardTitle = (card: Card): string => {
		// Character cards: show character name
		if (card.cardType === 'CHARACTER_CARD' && hasCharacterName(card.details)) {
         switch (card.details.game) {
            case 'LEGENDS':
               return t('Cards.heroCard') || 'Hero Card';
            case 'CITY_OF_MIST':
               return t('Cards.riftCard') || 'Rift Card';
            case 'OTHERSCAPE':
               return t('Cards.mercCard') || 'Merc Card';
            default:
               return t('Cards.characterCard') || 'Character Card';
         }
		}

		// Loadout cards: show main tag name
		if (card.cardType === 'LOADOUT_THEME') {
			const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;
			return mainTag || t('Cards.otherscapeLoadoutCard') || 'Loadout';
		}

		if (card.cardType === 'GROUP_THEME') {
			const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;

			if (mainTag) {
				switch (card.details.game) {
					case 'LEGENDS':
						return `${t('Cards.fellowshipCard') || 'Fellowship'} - ${mainTag}`;
					case 'CITY_OF_MIST':
						return `${t('Cards.crewCard') || 'Crew'} - ${mainTag}`;
					case 'OTHERSCAPE':
						return `${t('Cards.otherscapeCrewCard') || 'Crew'} - ${mainTag}`;
					default:
						return mainTag;
				}
			}
			return t('Cards.fellowshipCard') || 'Group Theme';
		}

		// Theme cards: show "Themebook - Main Tag" or just themebook
		if (card.cardType === 'CHARACTER_THEME') {
			const themebook = hasThemebook(card.details) ? card.details.themebook : null;
			const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;

			if (themebook && mainTag) {
				return `${themebook} - ${mainTag}`;
			}
			if (themebook) {
				return themebook;
			}
			if (mainTag) {
				return mainTag;
			}
		}

		// Fallback to card type
		return t('Cards.themeCard') || 'Card';
	};



	if (!character) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center">
				<h2 className="text-xl font-bold mb-4">
					{t('MobileCharacterSheet.noCharacter') || 'No Character Loaded'}
				</h2>
				<p className="text-muted-foreground mb-6">
					{t('MobileCharacterSheet.loadCharacterPrompt') || 'Load a character from the drawer or create a new one to get started.'}
				</p>
				<p className="text-sm text-muted-foreground">
					{t('MobileCharacterSheet.drawerHint') || 'Tap the Drawer tab below to browse your saved characters.'}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Character Name Header */}
			<header className="p-4 bg-popover border-b border-border">
				<input
					type="text"
					value={localName}
					onChange={(e) => setLocalName(e.target.value)}
					className={cn(
						"w-full text-2xl font-bold bg-transparent outline-none transition-colors",
						"placeholder:text-muted-foreground/50",
						"focus:text-primary"
					)}
					placeholder={t('CharacterSheetPage.characterNamePlaceholder') || 'Character Name'}
				/>
			</header>

			{/* Tab Navigation */}
			<div className="flex border-b border-border bg-card">
				<button
					onClick={() => setActiveTab('trackers')}
					className={cn(
						"flex-1 px-4 py-3 text-sm font-medium transition-colors",
						"border-b-2",
						activeTab === 'trackers'
							? "border-primary text-primary bg-primary/5"
							: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
					)}
				>
					{t('MobileCharacterSheet.trackersTab') || 'Trackers'}
				</button>
				<button
					onClick={() => setActiveTab('cards')}
					className={cn(
						"flex-1 px-4 py-3 text-sm font-medium transition-colors",
						"border-b-2",
						activeTab === 'cards'
							? "border-primary text-primary bg-primary/5"
							: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
					)}
				>
					{t('MobileCharacterSheet.cardsTab') || 'Cards'}
					{character.cards.length > 0 && (
						<span className="ml-2 text-xs text-muted-foreground">
							({character.cards.length})
						</span>
					)}
				</button>
			</div>

			{/* Tab Content */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{activeTab === 'trackers' && (
					<div className="h-full overflow-y-auto p-4 pb-6 space-y-6">
						{/* Statuses Section */}
						<section>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{t('MobileCharacterSheet.statuses') || 'Statuses'}
							</h3>
							<div className="space-y-3">
								{character.trackers.statuses.map((tracker) => (
									<StatusTrackerCard
										key={tracker.id}
										tracker={tracker}
										isEditing={areTrackersEditable}
										onExport={() => {}}
									/>
								))}
								{areTrackersEditable && (
									<Button
										variant="ghost"
										onClick={() => addStatus()}
										className={cn(
											"w-full h-16 border-2 border-dashed border-primary/25",
											"text-muted-foreground bg-primary/5",
											"hover:text-foreground hover:border-foreground"
										)}
									>
										+ {t('Trackers.addStatus') || 'Add Status'}
									</Button>
								)}
							</div>
						</section>

						{/* Story Tags Section */}
						<section>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{t('MobileCharacterSheet.storyTags') || 'Story Tags'}
							</h3>
							<div className="space-y-3">
								{character.trackers.storyTags.map((tracker) => (
									<StoryTagTrackerCard
										key={tracker.id}
										tracker={tracker}
										isEditing={areTrackersEditable}
										onExport={() => {}}
									/>
								))}
								{areTrackersEditable && (
									<Button
										variant="ghost"
										onClick={() => addStoryTag()}
										className={cn(
											"w-full h-16 border-2 border-dashed border-primary/25",
											"text-muted-foreground bg-primary/5",
											"hover:text-foreground hover:border-foreground"
										)}
									>
										+ {t('Trackers.addStoryTag') || 'Add Story Tag'}
									</Button>
								)}
							</div>
						</section>

						{/* Story Themes Section */}
						<section>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{t('MobileCharacterSheet.storyThemes') || 'Story Themes'}
							</h3>
							<div className="space-y-3">
								{character.trackers.storyThemes.map((tracker) => (
									<StoryThemeTrackerCard
										key={tracker.id}
										tracker={tracker}
										isEditing={isEditing}
										onExport={() => {}}
									/>
								))}
							</div>
						</section>
					</div>
				)}

				{activeTab === 'cards' && (
					<>
						{/* Scrollable Card Display Area */}
						<div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
							<div className="min-h-full flex items-start justify-center">
								<MobileCardCarousel
									cards={character.cards}
									currentIndex={safeCardIndex}
								/>
							</div>
						</div>

						{/* Navigation Bar - Always Visible at Bottom */}
						{character.cards.length > 0 && (
							<div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 bg-card border-t border-border">
								<IconButton
									variant="outline"
									size="default"
									onClick={() => setCurrentCardIndex(i => Math.max(0, i - 1))}
									disabled={safeCardIndex === 0}
									aria-label="Previous card"
								>
									<ChevronLeft className="h-5 w-5" />
								</IconButton>

								<div className="flex-1 flex flex-col items-center gap-1.5">
									{/* Card Title */}
									<span className="text-sm font-medium truncate max-w-full">
										{getCardTitle(character.cards[safeCardIndex])}
									</span>

									{/* Dot Indicators */}
									<div className="flex items-center gap-1.5">
										{character.cards.map((_, index) => (
											<button
												key={index}
												onClick={() => setCurrentCardIndex(index)}
												className={cn(
													"h-2 w-2 rounded-full transition-all",
													index === safeCardIndex
														? "bg-primary w-6"
														: "bg-muted-foreground/30 hover:bg-muted-foreground/50"
												)}
												aria-label={`Go to card ${index + 1}`}
											/>
										))}
									</div>
								</div>

								<IconButton
									variant="outline"
									size="default"
									onClick={() => setCurrentCardIndex(i => Math.min(character.cards.length - 1, i + 1))}
									disabled={safeCardIndex === character.cards.length - 1}
									aria-label="Next card"
								>
									<ChevronRight className="h-5 w-5" />
								</IconButton>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
