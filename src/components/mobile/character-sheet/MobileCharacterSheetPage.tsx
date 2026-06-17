// -- React Imports --
import { useState, useEffect, useRef, startTransition } from 'react';

// -- Library Imports --
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import MobileCharacterSheet from '@/components/mobile/character-sheet/MobileCharacterSheet';
import MobileBottomTabs from '@/components/mobile/menu/MobileBottomTabs';
import MobileFAB from '@/components/mobile/menu/MobileFAB';
import MobileMenu from '@/components/mobile/menu/MobileMenu';
import MobileSettings from '@/components/mobile/menu/MobileSettings';
import MobileAbout from '@/components/mobile/menu/MobileAbout';
import MobilePatchNotes from '@/components/mobile/menu/MobilePatchNotes';
import MobileMainMenu from '@/components/mobile/menu/MobileMainMenu';
import MobileAddCard from '@/components/mobile/menu/MobileAddCard';
import MobileDrawer from '@/components/mobile/drawer/MobileDrawer';
import MobileTutorial from '@/components/mobile/tutorial/MobileTutorial';
import { CharacterBootLoading } from '@/components/molecules/CharacterBootLoading';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useIsBootHydrating } from '@/lib/character/characterPersistence';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { CreateCardOptions } from '@/lib/types/creation';
import type { Card } from '@/lib/types/character';

type TabId = 'sheet' | 'drawer' | 'menu' | 'settings' | 'about' | 'patchNotes' | 'addCard';
type SheetTab = 'trackers' | 'cards';
type NavigationTabId = 'sheet' | 'drawer' | 'menu';

interface HistoryState {
	tab: TabId;
	sheetTab?: SheetTab;
	isReordering?: boolean;
}

export default function MobileCharacterSheetPage() {
	const [activeTab, setActiveTab] = useState<TabId>('sheet');
	const [sheetActiveTab, setSheetActiveTab] = useState<SheetTab>('trackers');
	const [isMenuFABExpanded, setIsMenuFABExpanded] = useState(false);
	const [isToolbeltOpen, setIsToolbeltOpen] = useState(false);
	const [isReorderingCards, setIsReorderingCards] = useState(false);
	const isMobileFABMode = useAppSettingsStore((state) => state.isMobileFABMode);
	const character = useCharacterStore((state) => state.character);
	const isBootHydrating = useIsBootHydrating();
	const isMobileTutorialOpen = useAppGeneralStateStore((state) => state.isMobileTutorialOpen);
	const { setMobileOnboardingOpen, setMobileTutorialOpen } = useAppGeneralStateActions();

	// Card creation state
	const { t: tNotifications } = useTranslation();
	const { addCard, updateCardDetails, addImportedCard, addImportedTracker } = useCharacterActions();
	const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
	const [newlyCreatedCardId, setNewlyCreatedCardId] = useState<string | null>(null);

	// Track if we're handling a popstate event to avoid pushing duplicate history
	const isNavigatingBack = useRef(false);

	// Clear newly created card ID when navigating away from sheet tab
	useEffect(() => {
		if (activeTab !== 'sheet' || sheetActiveTab !== 'cards') {
			startTransition(() => {
				setNewlyCreatedCardId(null);
			});
		}
	}, [activeTab, sheetActiveTab]);

	// Helper function to push current state to history
	const pushHistoryState = (state: HistoryState) => {
		if (!isNavigatingBack.current) {
			window.history.pushState(state, '', window.location.pathname + window.location.search);
		}
	};

	// Helper function to navigate with history support
	const navigateToTab = (tab: TabId) => {
		setActiveTab(tab);
		pushHistoryState({
			tab,
			sheetTab: tab === 'sheet' ? sheetActiveTab : undefined,
			isReordering: tab === 'sheet' ? isReorderingCards : undefined
		});
	};

	// Helper function to navigate sheet tabs with history support
	const navigateToSheetTab = (tab: SheetTab) => {
		setSheetActiveTab(tab);
		pushHistoryState({
			tab: 'sheet',
			sheetTab: tab,
			isReordering: isReorderingCards
		});
	};

	// Helper function to toggle reordering with history support
	const setReorderingWithHistory = (isReordering: boolean) => {
		setIsReorderingCards(isReordering);
		pushHistoryState({
			tab: 'sheet',
			sheetTab: sheetActiveTab,
			isReordering
		});
	};

	// Handle browser back button
	useEffect(() => {
		// Set initial state
		const initialState: HistoryState = {
			tab: 'sheet',
			sheetTab: 'trackers',
			isReordering: false
		};
		window.history.replaceState(initialState, '', window.location.pathname + window.location.search);

		const handlePopState = (event: PopStateEvent) => {
			// Set flag BEFORE updating any state
			isNavigatingBack.current = true;

			const state = event.state as HistoryState | null;

			if (state) {
				// Update all states directly without triggering navigation functions
				setActiveTab(state.tab);
				if (state.tab === 'sheet') {
					setSheetActiveTab(state.sheetTab || 'trackers');
					setIsReorderingCards(state.isReordering || false);
				} else {
					// Reset sheet state when not on sheet tab
					setIsReorderingCards(false);
				}
			} else {
				// If no state (initial page load or external navigation), reset to defaults
				setActiveTab('sheet');
				setSheetActiveTab('trackers');
				setIsReorderingCards(false);
			}

			// Reset flag after a tick to allow state updates to complete
			setTimeout(() => {
				isNavigatingBack.current = false;
			}, 0);
		};

		window.addEventListener('popstate', handlePopState);

		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	}, []);

	const handleStartTour = () => {
		navigateToTab('sheet');
		setMobileTutorialOpen(true);
	};

	const handleRestartOnboarding = () => {
		navigateToTab('menu');
		setMobileOnboardingOpen(true);
	};

	const handleOpenDrawer = () => {
		navigateToTab('drawer');
		// TODO: Implement drawer opening
	};

	const handleOpenMenu = () => {
		navigateToTab('menu');
	};

	const handleOpenSettings = () => {
		navigateToTab('settings');
	};

	const handleOpenAbout = () => {
		navigateToTab('about');
	};

	const handleOpenPatchNotes = () => {
		navigateToTab('patchNotes');
	};

	const handleOpenAddCard = () => {
		setCardToEdit(null);
		navigateToTab('addCard');
	};

	const handleEditCard = (card: Card) => {
		setCardToEdit(card);
		navigateToTab('addCard');
	};

	const handleConfirmCard = (options: CreateCardOptions, cardId?: string) => {
		let resolvedCardId: string;
		if (cardId) {
			// Edit mode: change only the themebook/type of the existing card, preserving its tags.
			updateCardDetails(cardId, { themebook: options.themebook, themeType: options.themeType });
			resolvedCardId = cardId;
		} else {
			// Create mode: add a new card.
			resolvedCardId = addCard(options);
		}
		setCardToEdit(null);
		setNewlyCreatedCardId(resolvedCardId);
		navigateToTab('sheet');
		navigateToSheetTab('cards');
	};

	const handleAddDrawerItemToCharacter = (item: import('@/lib/types/drawer').DrawerItem) => {
		if (item.game !== character?.game) {
			toast.error(tNotifications('Notifications.general.importFailedWrongGame'));
			return;
		}

		const cardTypes = ['CHARACTER_CARD', 'CHARACTER_THEME', 'GROUP_THEME', 'LOADOUT_THEME'];
		const trackerTypes = ['STATUS_TRACKER', 'STORY_TAG_TRACKER', 'STORY_THEME_TRACKER'];

		if (cardTypes.includes(item.type)) {
			addImportedCard(item.content as Card);
		} else if (trackerTypes.includes(item.type)) {
			addImportedTracker(item.content as import('@/lib/types/character').Tracker);
		}
	};

	// Boot loading gate (spec §5, C-4): while the active character is still being
	// read from IndexedDB, show a neutral loading screen rather than flashing the
	// main menu before the sheet resolves.
	if (isBootHydrating && !character) {
		return <CharacterBootLoading />;
	}

	// If no character is loaded, show the main menu
	if (!character) {
		return (
			<div className="overflow-hidden" style={{ height: '100dvh', width: '100dvw' }}>
				<MobileMainMenu onOpenDrawer={handleOpenDrawer} />
			</div>
		);
	}

	return (
		<div className="overflow-hidden flex flex-col" style={{ height: '100dvh', width: '100dvw' }}>
			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				{activeTab === 'sheet' && (
					<MobileCharacterSheet
						activeTab={sheetActiveTab}
						onTabChange={navigateToSheetTab}
						isToolbeltOpen={isToolbeltOpen}
						onToolbeltOpenChange={setIsToolbeltOpen}
						isMenuFABExpanded={isMenuFABExpanded}
						isReorderingCards={isReorderingCards}
						onReorderingCardsChange={setReorderingWithHistory}
						onOpenAddCard={handleOpenAddCard}
						onEditCard={handleEditCard}
						initialCardId={newlyCreatedCardId}
					/>
				)}
				{activeTab === 'drawer' && (
					<MobileDrawer onAddToCharacter={handleAddDrawerItemToCharacter} />
				)}
				{activeTab === 'menu' && (
					<MobileMenu
						onOpenSettings={handleOpenSettings}
						onOpenAbout={handleOpenAbout}
						onOpenPatchNotes={handleOpenPatchNotes}
					/>
				)}
				{activeTab === 'settings' && (
					<MobileSettings
						onStartTour={handleStartTour}
						onRestartOnboarding={handleRestartOnboarding}
						onBack={() => navigateToTab('menu')}
					/>
				)}
				{activeTab === 'about' && (
					<MobileAbout onBack={() => navigateToTab('menu')} />
				)}
				{activeTab === 'patchNotes' && (
					<MobilePatchNotes onBack={() => navigateToTab('menu')} />
				)}
				{activeTab === 'addCard' && (
					<MobileAddCard
						onBack={() => navigateToTab('sheet')}
						onConfirm={handleConfirmCard}
						mode={cardToEdit ? 'edit' : 'create'}
						cardData={cardToEdit ?? undefined}
						game={character.game}
					/>
				)}
			</div>

			{/* Navigation - Hidden when reordering cards or in settings/about/patchNotes/addCard */}
			{!isReorderingCards && activeTab !== 'settings' && activeTab !== 'about' && activeTab !== 'patchNotes' && activeTab !== 'addCard' && (
				!isMobileFABMode ? (
					<MobileBottomTabs
						activeTab={activeTab as NavigationTabId}
						onTabChange={navigateToTab}
						isToolbeltOpen={isToolbeltOpen}
						onToggleToolbelt={() => setIsToolbeltOpen((open) => !open)}
					/>
				) : (
					<MobileFAB
						activeTab={activeTab as NavigationTabId}
						onTabChange={navigateToTab}
						onOpenDrawer={handleOpenDrawer}
						onOpenMenu={handleOpenMenu}
						sheetActiveTab={activeTab === 'sheet' ? sheetActiveTab : undefined}
						isToolbeltOpen={isToolbeltOpen}
						isExpanded={isMenuFABExpanded}
						onIsExpandedChange={setIsMenuFABExpanded}
					/>
				)
			)}

			{/* Mobile Tutorial */}
			<MobileTutorial
				isOpen={isMobileTutorialOpen}
				onComplete={() => setMobileTutorialOpen(false)}
				actions={{
					navigateToTab,
					setSheetTab: setSheetActiveTab,
					openSettings: handleOpenSettings,
					closeSettings: () => navigateToTab('menu'),
					expandFAB: () => setIsMenuFABExpanded(true),
					collapseFAB: () => setIsMenuFABExpanded(false),
					openToolbelt: () => setIsToolbeltOpen(true),
					closeToolbelt: () => setIsToolbeltOpen(false),
				}}
			/>
		</div>
	);
}
