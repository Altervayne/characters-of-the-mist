// -- React Imports --
import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/molecules/status-tracker';
import { StoryTagTrackerCard } from '@/components/molecules/story-tag-tracker';
import { StoryThemeTrackerCard } from '@/components/organisms/story-theme-tracker';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import MobileCardCarousel from './MobileCardCarousel';
import MobileToolbelt from './MobileToolbelt';
import SelectableTracker from './SelectableTracker';

// -- Icon Imports --
import { ChevronLeft, ChevronRight, Wrench } from 'lucide-react';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Card, CardDetails } from '@/lib/types/character';
import type { ToolbeltContext } from '@/lib/types/toolbelt';



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



interface MobileCharacterSheetProps {
	activeTab?: SheetTab;
	onTabChange?: (tab: SheetTab) => void;
	isToolbeltOpen?: boolean;
	onToolbeltOpenChange?: (isOpen: boolean) => void;
	isMenuFABExpanded?: boolean;
}

export default function MobileCharacterSheet({
	activeTab: controlledActiveTab,
	onTabChange: controlledOnTabChange,
	isToolbeltOpen: controlledIsToolbeltOpen,
	onToolbeltOpenChange: controlledOnToolbeltOpenChange,
	isMenuFABExpanded
}: MobileCharacterSheetProps = {}) {
	const { t } = useTranslation();
	const [internalActiveTab, setInternalActiveTab] = useState<SheetTab>('trackers');

	// Use controlled or uncontrolled state for activeTab
	const activeTab = controlledActiveTab ?? internalActiveTab;
	const setActiveTab = controlledOnTabChange ?? setInternalActiveTab;

	// Use controlled or uncontrolled state for toolbelt
	const [internalIsToolbeltOpen, setInternalIsToolbeltOpen] = useState(false);
	const isToolbeltOpen = controlledIsToolbeltOpen ?? internalIsToolbeltOpen;
	const setIsToolbeltOpen = controlledOnToolbeltOpenChange ?? setInternalIsToolbeltOpen;

	// Character data
	const character = useCharacterStore((state) => state.character);
	const { updateCharacterName, addStatus, addStoryTag, flipCard } = useCharacterActions();

	// Settings
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const isTrackersAlwaysEditable = useAppSettingsStore((state) => state.isTrackersAlwaysEditable);
	const areTrackersEditable = isEditing || isTrackersAlwaysEditable;
	const isMobileFABMode = useAppSettingsStore((state) => state.isMobileFABMode);

	// Card navigation state
	const [currentCardIndex, setCurrentCardIndex] = useState(0);

	// Toolbelt context state
	const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);

	// Character name input with debouncing
	const [localName, setLocalName] = useInputDebouncer(
		character?.name || '',
		(value) => updateCharacterName(value)
	);

	// Safe card index (clamp to valid range)
	const safeCardIndex = character && character.cards.length > 0
		? Math.min(currentCardIndex, character.cards.length - 1)
		: 0;

	// Swipe gesture detection for card area (edge swipes for flip/toolbelt)
	const cardSwipeStartX = useRef<number>(0);
	const cardSwipeStartY = useRef<number>(0);

	const handleCardAreaTouchStart = (e: React.TouchEvent) => {
		cardSwipeStartX.current = e.touches[0].clientX;
		cardSwipeStartY.current = e.touches[0].clientY;
	};

	// Swipe gesture detection for navigation bar (card navigation)
	const navSwipeStartX = useRef<number>(0);
	const navSwipeStartY = useRef<number>(0);

	const handleNavBarTouchStart = (e: React.TouchEvent) => {
		navSwipeStartX.current = e.touches[0].clientX;
		navSwipeStartY.current = e.touches[0].clientY;
	};

	const handleNavBarTouchEnd = (e: React.TouchEvent) => {
		if (!character || character.cards.length === 0) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - navSwipeStartX.current;
		const deltaY = touchEndY - navSwipeStartY.current;

		// Only process horizontal swipes with 50px threshold
		if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 50) return;

		// Swipe left = next card
		if (deltaX < 0 && safeCardIndex < character.cards.length - 1) {
			setCurrentCardIndex(i => i + 1);
		}
		// Swipe right = previous card
		else if (deltaX > 0 && safeCardIndex > 0) {
			setCurrentCardIndex(i => i - 1);
		}
	};

	const handleCardAreaTouchEnd = (e: React.TouchEvent) => {
		if (!character || character.cards.length === 0) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - cardSwipeStartX.current;
		const deltaY = touchEndY - cardSwipeStartY.current;

		// Only process horizontal swipes
		if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 30) return;

		const currentCard = character.cards[safeCardIndex];
		const edgeThreshold = 50;
		const swipeThreshold = 30;

		// Left edge swipe (within 50px from left) → Flip card
		if (cardSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
			flipCard(currentCard.id);
		}
		// Right edge swipe (within 50px from right)
		else if (cardSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
			if (!isMobileFABMode && !isToolbeltOpen) {
				// Bottom tabs mode (with side-panel toolbelt): Open toolbelt
				setIsToolbeltOpen(true);
			} else if (isMobileFABMode) {
				// FAB mode: Flip card (toolbelt is accessible via FAB)
				flipCard(currentCard.id);
			}
		}
	};

	// Build toolbelt context based on active tab and selection
	const toolbeltContext: ToolbeltContext = useMemo(() => {
		if (activeTab === 'cards' && character && character.cards.length > 0) {
			return { type: 'card', card: character.cards[safeCardIndex] };
		}
		if (activeTab === 'trackers' && selectedTrackerId && character) {
			// Check statuses
			const status = character.trackers.statuses.find(t => t.id === selectedTrackerId);
			if (status) return { type: 'tracker', tracker: status };

			// Check story tags
			const storyTag = character.trackers.storyTags.find(t => t.id === selectedTrackerId);
			if (storyTag) return { type: 'tracker', tracker: storyTag };

			// Check story themes
			const storyTheme = character.trackers.storyThemes.find(t => t.id === selectedTrackerId);
			if (storyTheme) return { type: 'tracker', tracker: storyTheme };
		}
		return { type: 'none' };
	}, [activeTab, character, safeCardIndex, selectedTrackerId]);

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
			<header className="p-4 bg-popover border-b border-border flex items-center gap-3">
				<input
					type="text"
					value={localName}
					onChange={(e) => setLocalName(e.target.value)}
					className={cn(
						"flex-1 text-2xl font-bold bg-transparent outline-none transition-colors",
						"placeholder:text-muted-foreground/50",
						"focus:text-primary"
					)}
					placeholder={t('CharacterSheetPage.characterNamePlaceholder') || 'Character Name'}
				/>
			</header>

			{/* Tab Navigation */}
			<div className="flex items-center border-b border-border bg-card">
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

				{/* Toolbelt trigger button (only for bottom tabs mode with side-panel) */}
				{!isMobileFABMode && (
					<div className="px-2">
						<IconButton
							variant="ghost"
							size="sm"
							onClick={() => setIsToolbeltOpen(true)}
							aria-label="Open actions"
							className="h-8 w-8"
						>
							<Wrench className="h-4 w-4" />
						</IconButton>
					</div>
				)}
			</div>

			{/* Tab Content */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{activeTab === 'trackers' && (
					<div className="h-full overflow-y-auto p-4 pb-6">
						<div className="max-w-7xl mx-auto space-y-6">
							{/* Statuses Section */}
							<section>
								<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
									{t('MobileCharacterSheet.statuses') || 'Statuses'}
								</h3>
								<div className="flex flex-wrap justify-center gap-3">
									{character.trackers.statuses.map((tracker) => (
										<SelectableTracker
											key={tracker.id}
											tracker={tracker}
											isSelected={selectedTrackerId === tracker.id}
											onSelect={(id) => setSelectedTrackerId(id === selectedTrackerId ? null : id)}
										>
											<StatusTrackerCard
												tracker={tracker}
												isEditing={areTrackersEditable}
												onExport={() => {}}
											/>
										</SelectableTracker>
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
								<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
									{t('MobileCharacterSheet.storyTags') || 'Story Tags'}
								</h3>
								<div className="flex flex-wrap justify-center gap-3">
									{character.trackers.storyTags.map((tracker) => (
										<SelectableTracker
											key={tracker.id}
											tracker={tracker}
											isSelected={selectedTrackerId === tracker.id}
											onSelect={(id) => setSelectedTrackerId(id === selectedTrackerId ? null : id)}
										>
											<StoryTagTrackerCard
												tracker={tracker}
												isEditing={areTrackersEditable}
												onExport={() => {}}
											/>
										</SelectableTracker>
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
								<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
									{t('MobileCharacterSheet.storyThemes') || 'Story Themes'}
								</h3>
								<div className="flex flex-wrap justify-center gap-3">
									{character.trackers.storyThemes.map((tracker) => (
										<SelectableTracker
											key={tracker.id}
											tracker={tracker}
											isSelected={selectedTrackerId === tracker.id}
											onSelect={(id) => setSelectedTrackerId(id === selectedTrackerId ? null : id)}
										>
											<StoryThemeTrackerCard
												tracker={tracker}
												isEditing={isEditing}
												onExport={() => {}}
											/>
										</SelectableTracker>
									))}
								</div>
							</section>
						</div>
					</div>
				)}

				{activeTab === 'cards' && (
					<>
						{/* Scrollable Card Display Area */}
						<div
							className="flex-1 overflow-y-auto overflow-x-hidden p-4"
							onTouchStart={handleCardAreaTouchStart}
							onTouchEnd={handleCardAreaTouchEnd}
						>
							<div className="min-h-full flex items-center justify-center">
								<MobileCardCarousel
									cards={character.cards}
									currentIndex={safeCardIndex}
								/>
							</div>
						</div>

						{/* Navigation Bar - Always Visible at Bottom */}
						{character.cards.length > 0 && (
							<div
								className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-card border-t border-border"
								onTouchStart={handleNavBarTouchStart}
								onTouchEnd={handleNavBarTouchEnd}
							>
								<IconButton
									variant="outline"
									size="sm"
									onClick={() => setCurrentCardIndex(i => Math.max(0, i - 1))}
									disabled={safeCardIndex === 0}
									aria-label="Previous card"
									className="h-8 w-8"
								>
									<ChevronLeft className="h-4 w-4" />
								</IconButton>

								<div className="flex-1 flex flex-col items-center justify-center gap-1">
									{/* Card Title */}
									<span className="text-xs font-medium truncate max-w-full text-center">
										{getCardTitle(character.cards[safeCardIndex])}
									</span>

									{/* Dot Indicators */}
									<div className="flex items-center gap-1">
										{character.cards.map((_, index) => (
											<button
												key={index}
												onClick={() => setCurrentCardIndex(index)}
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
									onClick={() => setCurrentCardIndex(i => Math.min(character.cards.length - 1, i + 1))}
									disabled={safeCardIndex === character.cards.length - 1}
									aria-label="Next card"
									className="h-8 w-8"
								>
									<ChevronRight className="h-4 w-4" />
								</IconButton>
							</div>
						)}
					</>
				)}
			</div>

			{/* Toolbelt */}
			<MobileToolbelt
				mode={isMobileFABMode ? 'fab' : 'side-panel'}
				context={toolbeltContext}
				isOpen={isToolbeltOpen}
				onOpenChange={setIsToolbeltOpen}
				activeTab={activeTab}
				isMenuFABExpanded={isMenuFABExpanded}
			/>
		</div>
	);
}
