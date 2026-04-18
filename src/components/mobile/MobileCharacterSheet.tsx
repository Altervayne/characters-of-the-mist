// -- React Imports --
import { useState, useMemo, useRef, useEffect, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/molecules/StatusTracker';
import { StoryTagTrackerCard } from '@/components/molecules/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/StoryThemeTracker';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import MobileCardCarousel from './MobileCardCarousel';
import MobileToolbelt from './MobileToolbelt';
import MobileSaveToDrawerSheet from './MobileSaveToDrawerSheet';
import SelectableTracker from './SelectableTracker';
import { LegendsThemeCard } from '@/components/organisms/LegendsThemeCard';
import { CityThemeCard } from '@/components/organisms/CityThemeCard';
import { OtherscapeThemeCard } from '@/components/organisms/OtherscapeThemeCard';
import { HeroCard } from '@/components/organisms/HeroCard';
import { RiftCard } from '@/components/organisms/RiftCard';
import { OtherscapeCharacterCard } from '@/components/organisms/OtherscapeCharacterCard';

// -- Icon Imports --
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, PlusCircle, Wrench, Check, SquareDashed } from 'lucide-react';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useDrawerActions } from '@/lib/stores/drawerStore';
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { mapItemToStorableInfo } from '@/lib/utils/dnd';

// -- Type Imports --
import type { Card, CardDetails, Tracker } from '@/lib/types/character';
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
	isReorderingCards?: boolean;
	onReorderingCardsChange?: (isReordering: boolean) => void;
	onOpenAddCard?: () => void;
	initialCardId?: string | null;
}

export default function MobileCharacterSheet({
	activeTab: controlledActiveTab,
	onTabChange: controlledOnTabChange,
	isToolbeltOpen: controlledIsToolbeltOpen,
	onToolbeltOpenChange: controlledOnToolbeltOpenChange,
	isMenuFABExpanded,
	isReorderingCards: controlledIsReorderingCards,
	onReorderingCardsChange: controlledOnReorderingCardsChange,
	onOpenAddCard,
	initialCardId
}: MobileCharacterSheetProps = {}) {
	const { t } = useTranslation();
	const [internalActiveTab, setInternalActiveTab] = useState<SheetTab>('trackers');

	// ActiveTab
	const activeTab = controlledActiveTab ?? internalActiveTab;
	const setActiveTab = controlledOnTabChange ?? setInternalActiveTab;

	// Toolbelt
	const [internalIsToolbeltOpen, setInternalIsToolbeltOpen] = useState(false);
	const isToolbeltOpen = controlledIsToolbeltOpen ?? internalIsToolbeltOpen;
	const setIsToolbeltOpen = controlledOnToolbeltOpenChange ?? setInternalIsToolbeltOpen;

	// Reordering
	const [internalIsReorderingCards, setInternalIsReorderingCards] = useState(false);
	const isReorderingCards = controlledIsReorderingCards ?? internalIsReorderingCards;
	const setIsReorderingCards = controlledOnReorderingCardsChange ?? setInternalIsReorderingCards;

	// Character data
	const character = useCharacterStore((state) => state.character);
	const { updateCharacterName, addStatus, addStoryTag, addStoryTheme, flipCard, reorderStatuses, reorderStoryTags, reorderStoryThemes, reorderCards } = useCharacterActions();
	const { addItem: addDrawerItem } = useDrawerActions();

	// Settings
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const isTrackersAlwaysEditable = useAppSettingsStore((state) => state.isTrackersAlwaysEditable);
	const areTrackersEditable = isEditing || isTrackersAlwaysEditable;
	const isMobileFABMode = useAppSettingsStore((state) => state.isMobileFABMode);
	const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
	const isLeftHanded = mobileHandedness === 'left';

	// Card navigation state
	const [currentCardIndex, setCurrentCardIndex] = useState(0);

	// Navigate to a specific card when initialCardId changes
	useEffect(() => {
		if (initialCardId && character?.cards) {
			const cardIndex = character.cards.findIndex(card => card.id === initialCardId);
			if (cardIndex !== -1) {
				startTransition(() => {
					setCurrentCardIndex(cardIndex);
				});
			}
		}
	}, [initialCardId]);
   
	// Toolbelt context state
	const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
	const [isReorderingTracker, setIsReorderingTracker] = useState(false);

	// Save to Drawer sheet state
	const [isSaveToDrawerOpen, setIsSaveToDrawerOpen] = useState(false);
	const [saveToDrawerItem, setSaveToDrawerItem] = useState<Card | Tracker | null>(null);
	const [saveToDrawerDefaultName, setSaveToDrawerDefaultName] = useState('');

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

		// Check for vertical swipe up (negative deltaY) to enter reorder mode
		if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -50) {
			setIsReorderingCards(true);
			return;
		}

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

		// Edge swipe behavior depends on handedness setting
		if (isLeftHanded) {
			// Left-handed mode: Right edge = flip, Left edge = toolbelt
			if (cardSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
				// Right edge swipe → Flip card
				flipCard(currentCard.id);
			}
			else if (cardSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				// Left edge swipe → Open toolbelt (side-panel mode only)
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				} else if (isMobileFABMode) {
					// FAB mode: Flip card (toolbelt is accessible via FAB)
					flipCard(currentCard.id);
				}
			}
		} else {
			// Right-handed mode (default): Left edge = flip, Right edge = toolbelt
			if (cardSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				// Left edge swipe → Flip card
				flipCard(currentCard.id);
			}
			else if (cardSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
				// Right edge swipe → Open toolbelt (side-panel mode only)
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				} else if (isMobileFABMode) {
					// FAB mode: Flip card (toolbelt is accessible via FAB)
					flipCard(currentCard.id);
				}
			}
		}
	};

	// Swipe gesture detection for trackers area (edge swipe for toolbelt)
	const trackersSwipeStartX = useRef<number>(0);
	const trackersSwipeStartY = useRef<number>(0);

	const handleTrackersAreaTouchStart = (e: React.TouchEvent) => {
		trackersSwipeStartX.current = e.touches[0].clientX;
		trackersSwipeStartY.current = e.touches[0].clientY;
	};

	const handleTrackersAreaTouchEnd = (e: React.TouchEvent) => {
		if (!character) return;

		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - trackersSwipeStartX.current;
		const deltaY = touchEndY - trackersSwipeStartY.current;

		// Only process horizontal swipes
		if (Math.abs(deltaX) < Math.abs(deltaY) || Math.abs(deltaX) < 30) return;

		const edgeThreshold = 50;
		const swipeThreshold = 30;

		// Edge swipe behavior depends on handedness setting (only in side-panel mode)
		if (isLeftHanded) {
			// Left-handed mode: Left edge → Open toolbelt
			if (trackersSwipeStartX.current < edgeThreshold && deltaX > swipeThreshold) {
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				}
			}
		} else {
			// Right-handed mode: Right edge → Open toolbelt
			if (trackersSwipeStartX.current > window.innerWidth - edgeThreshold && deltaX < -swipeThreshold) {
				if (!isMobileFABMode && !isToolbeltOpen) {
					setIsToolbeltOpen(true);
				}
			}
		}
	};

	// Helper functions for tracker reordering
	const moveTrackerUp = () => {
		if (!selectedTrackerId || !character || isReorderingTracker) return;

		setIsReorderingTracker(true);

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex > 0) {
			reorderStatuses(statusIndex, statusIndex - 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex > 0) {
			reorderStoryTags(tagIndex, tagIndex - 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		if (themeIndex > 0) {
			reorderStoryThemes(themeIndex, themeIndex - 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
		} else {
			setIsReorderingTracker(false);
		}
	};

	const moveTrackerDown = () => {
		if (!selectedTrackerId || !character || isReorderingTracker) return;

		setIsReorderingTracker(true);

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex !== -1 && statusIndex < character.trackers.statuses.length - 1) {
			reorderStatuses(statusIndex, statusIndex + 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex !== -1 && tagIndex < character.trackers.storyTags.length - 1) {
			reorderStoryTags(tagIndex, tagIndex + 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
			return;
		}

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		if (themeIndex !== -1 && themeIndex < character.trackers.storyThemes.length - 1) {
			reorderStoryThemes(themeIndex, themeIndex + 1);
			setTimeout(() => setIsReorderingTracker(false), 100);
		} else {
			setIsReorderingTracker(false);
		}
	};

	const canMoveTrackerUp = useMemo(() => {
		if (!selectedTrackerId || !character) return false;

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex > 0) return true;

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex > 0) return true;

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		return themeIndex > 0;
	}, [selectedTrackerId, character]);

	const canMoveTrackerDown = useMemo(() => {
		if (!selectedTrackerId || !character) return false;

		const statusIndex = character.trackers.statuses.findIndex(t => t.id === selectedTrackerId);
		if (statusIndex !== -1 && statusIndex < character.trackers.statuses.length - 1) return true;

		const tagIndex = character.trackers.storyTags.findIndex(t => t.id === selectedTrackerId);
		if (tagIndex !== -1 && tagIndex < character.trackers.storyTags.length - 1) return true;

		const themeIndex = character.trackers.storyThemes.findIndex(t => t.id === selectedTrackerId);
		return themeIndex !== -1 && themeIndex < character.trackers.storyThemes.length - 1;
	}, [selectedTrackerId, character]);



	// Helper functions for card reordering
	const [isReorderingCard, setIsReorderingCard] = useState(false);

	const moveCardUp = (cardIndex: number) => {
		if (cardIndex <= 0 || !character || isReorderingCard) return;
		setIsReorderingCard(true);
		reorderCards(cardIndex, cardIndex - 1);
		setTimeout(() => setIsReorderingCard(false), 100);
	};

	const moveCardDown = (cardIndex: number) => {
		if (!character || cardIndex >= character.cards.length - 1 || isReorderingCard) return;
		setIsReorderingCard(true);
		reorderCards(cardIndex, cardIndex + 1);
		setTimeout(() => setIsReorderingCard(false), 100);
	};



	// Save to Drawer handlers
	const handleSaveToDrawer = (item: Card | Tracker) => {
		const defaultName = 'cardType' in item ? getCardTitle(item) : item.name;
		setSaveToDrawerItem(item);
		setSaveToDrawerDefaultName(defaultName);
		setIsSaveToDrawerOpen(true);
	};

	const handleConfirmSaveToDrawer = (name: string) => {
		if (!saveToDrawerItem) return;
		const storableInfo = mapItemToStorableInfo(saveToDrawerItem);
		if (!storableInfo) return;
		const [type, game] = storableInfo;
		const contentCopy = JSON.parse(JSON.stringify(saveToDrawerItem));
		if ('isFlipped' in contentCopy) contentCopy.isFlipped = false;
		addDrawerItem(name, game, type, contentCopy);
		toast.success(t('Notifications.drawer.itemCreated'));
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
               return t('Cards.heroCard');
            case 'CITY_OF_MIST':
               return t('Cards.riftCard');
            case 'OTHERSCAPE':
               return t('Cards.mercCard');
            default:
               return t('Cards.characterCard');
         }
		}

		// Loadout cards: show main tag name
		if (card.cardType === 'LOADOUT_THEME') {
			const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;
			return mainTag || t('Cards.otherscapeLoadoutCard');
		}

		if (card.cardType === 'GROUP_THEME') {
			const mainTag = hasMainTag(card.details) ? card.details.mainTag.name : null;

			if (mainTag) {
				switch (card.details.game) {
					case 'LEGENDS':
						return `${t('Cards.fellowshipCard')} - ${mainTag}`;
					case 'CITY_OF_MIST':
						return `${t('Cards.crewCard')} - ${mainTag}`;
					case 'OTHERSCAPE':
						return `${t('Cards.otherscapeCrewCard')} - ${mainTag}`;
					default:
						return mainTag;
				}
			}
			return t('Cards.fellowshipCard');
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
		return t('Cards.themeCard');
	};

   

	// Helper function to render card preview (like in Drawer)
	// Force SIDE_BY_SIDE mode and front face for previews
	const renderCardPreview = (card: Card) => {
		const game = card.details.game;
		const previewCard = { ...card, viewMode: 'SIDE_BY_SIDE' as const, isFlipped: false };

		if (game === 'LEGENDS') {
			if (card.cardType === 'CHARACTER_CARD') {
				return <HeroCard card={previewCard} isDrawerPreview />;
			}
			if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME' || card.cardType === 'LOADOUT_THEME') {
				return <LegendsThemeCard card={previewCard} isDrawerPreview />;
			}
		}

		if (game === 'CITY_OF_MIST') {
			if (card.cardType === 'CHARACTER_CARD') {
				return <RiftCard card={previewCard} isDrawerPreview />;
			}
			if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME') {
				return <CityThemeCard card={previewCard} isDrawerPreview />;
			}
		}

		if (game === 'OTHERSCAPE') {
			if (card.cardType === 'CHARACTER_CARD') {
				return <OtherscapeCharacterCard card={previewCard} isDrawerPreview />;
			}
			if (card.cardType === 'CHARACTER_THEME' || card.cardType === 'GROUP_THEME' || card.cardType === 'LOADOUT_THEME') {
				return <OtherscapeThemeCard card={previewCard} isDrawerPreview />;
			}
		}

		return null;
	};



	if (!character) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center">
				<h2 className="text-xl font-bold mb-4">
					{t('MobileCharacterSheet.noCharacter')}
				</h2>
				<p className="text-muted-foreground mb-6">
					{t('MobileCharacterSheet.loadCharacterPrompt')}
				</p>
				<p className="text-sm text-muted-foreground">
					{t('MobileCharacterSheet.drawerHint')}
				</p>
			</div>
		);
	}

	return (
		<>
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
					placeholder={t('CharacterSheetPage.characterNamePlaceholder')}
				/>
			</header>

			{/* Tab Navigation - Hidden when reordering cards */}
			{!isReorderingCards && (
            <div className="flex items-center border-b border-border bg-card">
               {/* Toolbelt trigger button (left side for left-handed) */}
               {!isMobileFABMode && isLeftHanded && (
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

               <button
                  onClick={() => setActiveTab('trackers')}
                  data-tutorial="trackers-tab"
                  className={cn(
                     "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                     "border-b-2",
                     activeTab === 'trackers'
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
               >
                  {t('MobileCharacterSheet.trackersTab')}
               </button>
               <button
                  onClick={() => setActiveTab('cards')}
                  data-tutorial="cards-tab"
                  className={cn(
                     "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                     "border-b-2",
                     activeTab === 'cards'
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
               >
                  {t('MobileCharacterSheet.cardsTab')}
                  {character.cards.length > 0 && (
                     <span className="ml-2 text-xs text-muted-foreground">
                        ({character.cards.length})
                     </span>
                  )}
               </button>

               {/* Toolbelt trigger button (right side for right-handed) */}
               {!isMobileFABMode && !isLeftHanded && (
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
			)}

			{/* Tab Content */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{activeTab === 'trackers' && (
					<div
						className={cn("h-full overflow-y-auto p-4", isMobileFABMode && "pb-32")}
						data-tutorial="trackers-section"
						onTouchStart={handleTrackersAreaTouchStart}
						onTouchEnd={handleTrackersAreaTouchEnd}
					>
						<div className="max-w-7xl mx-auto space-y-6">
							{/* Statuses Section */}
							{(character.trackers.statuses.length > 0 || areTrackersEditable) && (
							<section>
								<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
									{t('MobileCharacterSheet.statuses')}
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
												"w-55 h-25 border-2 border-dashed border-primary/25",
												"text-muted-foreground bg-primary/5",
												"hover:text-foreground hover:border-foreground",
												"flex items-center justify-center gap-2"
											)}
										>
											<PlusCircle className="mr-2 h-4 w-4" />
                                 {t('Trackers.addStatus')}
										</Button>
									)}
								</div>
							</section>
							)}

							{/* Story Tags Section */}
							{(character.trackers.storyTags.length > 0 || areTrackersEditable) && (
							<section>
								<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
									{t('MobileCharacterSheet.storyTags')}
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
												"w-55 min-h-13.75 py-2 border-2 border-dashed border-primary/25",
												"text-muted-foreground bg-primary/5",
												"hover:text-foreground hover:border-foreground",
												"flex items-center justify-center gap-2"
											)}
										>
											<PlusCircle className="mr-2 h-4 w-4" />
                                 {t('Trackers.addStoryTag')}
										</Button>
									)}
								</div>
							</section>
							)}

							{/* Story Themes Section */}
							{(character.trackers.storyThemes.length > 0 || areTrackersEditable) && (
							<section>
								<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
									{t('MobileCharacterSheet.storyThemes')}
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
									{areTrackersEditable && (
										<Button
											variant="ghost"
											onClick={() => addStoryTheme()}
											className={cn(
												"w-62.5 h-55 border-2 border-dashed border-primary/25",
												"text-muted-foreground bg-primary/5",
												"hover:text-foreground hover:border-foreground",
												"flex items-center justify-center gap-2"
											)}
										>
											<PlusCircle className="mr-2 h-4 w-4" />
                                 {t('Trackers.addStoryTheme')}
										</Button>
									)}
								</div>
							</section>
							)}
						</div>
					</div>
				)}

				{activeTab === 'cards' && (
					<>
						{/* Card Reorder View or Normal Card Display */}
						{isReorderingCards ? (
							<div className={cn("flex-1 overflow-y-auto p-4", isMobileFABMode && "pb-32")}>
								<div className="max-w-2xl mx-auto space-y-4">
									{/* Header */}
									<div className="flex items-center justify-center mb-4 sticky top-0 bg-background z-10 pb-2">
										<h2 className="text-lg font-semibold">{t('MobileCharacterSheet.reorderCards')}</h2>
									</div>

									{/* Card list with reorder controls */}
									{character.cards.map((card, index) => (
										<motion.div
											key={card.id}
											layout
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0, scale: 0.95 }}
											className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
										>
											{/* Card preview - clickable to navigate and close reorder mode */}
											<div
												className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
												onClick={() => {
													setCurrentCardIndex(index);
													setIsReorderingCards(false);
												}}
											>
												{renderCardPreview(card)}
											</div>

											{/* Reorder buttons */}
											<div className="flex flex-col gap-1 shrink-0">
												<IconButton
													variant="outline"
													size="lg"
													onClick={() => moveCardUp(index)}
													disabled={index === 0 || isReorderingCard}
													className="h-10 w-10"
												>
													<ChevronUp className="h-6 w-6" />
												</IconButton>
												<IconButton
													variant="outline"
													size="lg"
													onClick={() => moveCardDown(index)}
													disabled={index === character.cards.length - 1 || isReorderingCard}
													className="h-10 w-10"
												>
													<ChevronDown className="h-6 w-6" />
												</IconButton>
											</div>
										</motion.div>
									))}
								</div>
							</div>
						) : (
							<div
								className={cn("flex-1 overflow-y-auto overflow-x-hidden p-4", isMobileFABMode && "pb-32")}
								data-tutorial="card-carousel"
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
						)}

						{/* Navigation Bar - Only visible in normal card view */}
						{!isReorderingCards && character.cards.length > 0 && (
							<div
								className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 bg-card border-t border-border"
								onTouchStart={handleNavBarTouchStart}
								onTouchEnd={handleNavBarTouchEnd}
								data-tutorial="card-navigation-bar"
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



			{/* Toolbelt - Hidden when reordering cards */}
			{!isReorderingCards && (
				<MobileToolbelt
					mode={isMobileFABMode ? 'fab' : 'side-panel'}
					context={toolbeltContext}
					isOpen={isToolbeltOpen}
					onOpenChange={setIsToolbeltOpen}
					activeTab={activeTab}
					isMenuFABExpanded={isMenuFABExpanded}
					onEnterCardReorderMode={() => {
						setIsReorderingCards(true);
						setIsToolbeltOpen(false);
					}}
					onOpenAddCard={onOpenAddCard}
					onSaveToDrawer={handleSaveToDrawer}
				/>
			)}



			{/* Tracker Reorder Buttons - Only visible when tracker selected */}
			{selectedTrackerId && activeTab === 'trackers' && !isReorderingCards && (
				<div className={cn(
					"fixed bottom-32 z-25 flex flex-col gap-2",
					isLeftHanded ? "left-4" : "right-4"
				)}>
               <IconButton
						variant="default"
						size="lg"
						onClick={() => setSelectedTrackerId(null)}
						className="h-10 w-10 shadow-2xl"
					>
						<SquareDashed className="h-6 w-6" />
					</IconButton>
					<IconButton
						variant="default"
						size="lg"
						onClick={moveTrackerUp}
						disabled={!canMoveTrackerUp}
						className="h-10 w-10 shadow-2xl"
					>
						<ChevronUp className="h-6 w-6" />
					</IconButton>
					<IconButton
						variant="default"
						size="lg"
						onClick={moveTrackerDown}
						disabled={!canMoveTrackerDown}
						className="h-10 w-10 shadow-2xl"
					>
						<ChevronDown className="h-6 w-6" />
					</IconButton>
				</div>
			)}



			{/* Card Reorder Done Button */}
			{isReorderingCards && (
				<div className={cn(
               "fixed bottom-4 z-50",
               isLeftHanded ? "left-4" : "right-4"
            )}>
					<IconButton
						variant="default"
						size="lg"
						onClick={() => setIsReorderingCards(false)}
						className="h-10 w-10 shadow-2xl"
						aria-label={t('Common.done')}
					>
						<Check className="h-6 w-6" />
					</IconButton>
				</div>
			)}
		</div>

		{/* Save to Drawer Sheet */}
		<MobileSaveToDrawerSheet
			isOpen={isSaveToDrawerOpen}
			onClose={() => setIsSaveToDrawerOpen(false)}
			onConfirm={handleConfirmSaveToDrawer}
			defaultName={saveToDrawerDefaultName}
		/>
		</>
	);
}
