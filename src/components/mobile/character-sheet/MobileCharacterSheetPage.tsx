// -- React Imports --
import { useState, useEffect, useRef, startTransition } from 'react';

// -- Library Imports --
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import MobileCharacterSheet from '@/components/mobile/character-sheet/MobileCharacterSheet';
import MobileBottomTabs from '@/components/mobile/menu/MobileBottomTabs';
import MobileFAB from '@/components/mobile/menu/MobileFAB';
import MobileSettings from '@/components/mobile/menu/MobileSettings';
import MobileSettingsGeneral from '@/components/mobile/menu/MobileSettingsGeneral';
import MobileSettingsAppearance from '@/components/mobile/menu/MobileSettingsAppearance';
import MobileSettingsData from '@/components/mobile/menu/MobileSettingsData';
import MobileSettingsLearn from '@/components/mobile/menu/MobileSettingsLearn';
import MobileThemes from '@/components/mobile/menu/MobileThemes';
import MobileThemeEditor from '@/components/mobile/menu/MobileThemeEditor';
import MobileAbout from '@/components/mobile/menu/MobileAbout';
import MobilePatchNotes from '@/components/mobile/menu/MobilePatchNotes';
import MobileMainMenu from '@/components/mobile/menu/MobileMainMenu';
import MobileAddCard from '@/components/mobile/menu/MobileAddCard';
import MobileDrawer from '@/components/mobile/drawer/MobileDrawer';
import MobileTutorial from '@/components/mobile/tutorial/MobileTutorial';
import { MobileDiceTraySheet } from '@/components/mobile/dice/MobileDiceTraySheet';
import { CharacterBootLoading } from '@/components/molecules/CharacterBootLoading';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useTutorialStore } from '@/lib/tutorial/tutorialStore';
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';
import { useIsBootHydrating } from '@/lib/character/characterPersistence';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { CreateCardOptions } from '@/lib/types/creation';
import type { Card, Character } from '@/lib/types/character';
import type { DrawerItem } from '@/lib/types/drawer';

type TabId = 'sheet' | 'drawer' | 'menu' | 'settings' | 'settingsGeneral' | 'settingsAppearance' | 'settingsData' | 'settingsLearn' | 'themes' | 'themeEditor' | 'about' | 'patchNotes' | 'addCard';
type SheetTab = 'trackers' | 'cards';
type NavigationTabId = 'sheet' | 'drawer' | 'menu';

// The full-screen chrome tabs (settings drill-down, themes, about, add-card): the bottom navigation hides while
// any of these is open so it never sits over a pushed sub-screen.
const CHROME_TABS = new Set<TabId>(['settings', 'settingsGeneral', 'settingsAppearance', 'settingsData', 'settingsLearn', 'themes', 'themeEditor', 'about', 'patchNotes', 'addCard']);

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
	const { mobileOpenCharacter } = useTabManagerActions();
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

	// Launch a re-explorable tutorial from the settings list: leave the menu for the sheet, then run it. The
	// runner is app chrome (above this surface), so it survives the tab switch away from settings.
	const handleStartTutorial = (id: string) => {
		navigateToTab('sheet');
		useTutorialStore.getState().actions.start(id, 'settings');
	};

	const handleOpenDrawer = () => {
		navigateToTab('drawer');
	};

	const handleOpenMenu = () => {
		navigateToTab('menu');
	};

	const handleOpenSettings = () => {
		navigateToTab('settings');
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
		// NEUTRAL items are game-agnostic, so they drop onto any character's sheet.
		if (item.game !== 'NEUTRAL' && item.game !== character?.game) {
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

	// Load a saved character (its stored content, linked to its drawer item) as the active sheet - the
	// mobile loader disposes the previous live instance and starts it clean (matching its saved copy).
	const handleLoadCharacterFromDrawer = (item: DrawerItem) => {
		mobileOpenCharacter(item.content as Character, item.id);
		navigateToTab('sheet');
		toast.success(tNotifications('Notifications.character.loaded'));
	};

	// While the active character is still being read from IndexedDB, show a neutral
	// loading screen rather than flashing the
	// main menu before the sheet resolves.
	if (isBootHydrating && !character) {
		return <CharacterBootLoading />;
	}

	// The tab system is always active: with no character loaded, the sheet tab
	// hosts the main menu so the Drawer (where a character is loaded) stays
	// reachable through the bottom nav.
	const isMainMenu = activeTab === 'sheet' && !character;

	return (
		<div className="overflow-hidden flex flex-col" style={{ height: '100dvh', width: '100dvw' }}>
			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				{activeTab === 'sheet' && (
					character ? (
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
					) : (
						<MobileMainMenu onOpenSettings={handleOpenSettings} onCharacterOpened={() => navigateToTab('sheet')} />
					)
				)}
				{activeTab === 'drawer' && (
					<MobileDrawer onAddToCharacter={handleAddDrawerItemToCharacter} onLoadCharacter={handleLoadCharacterFromDrawer} />
				)}
				{activeTab === 'menu' && (
					<MobileMainMenu onOpenSettings={handleOpenSettings} onCharacterOpened={() => navigateToTab('sheet')} />
				)}
				{activeTab === 'settings' && (
					<MobileSettings
						onOpenGeneral={() => navigateToTab('settingsGeneral')}
						onOpenAppearance={() => navigateToTab('settingsAppearance')}
						onOpenData={() => navigateToTab('settingsData')}
						onOpenLearn={() => navigateToTab('settingsLearn')}
						onOpenWhatsNew={() => navigateToTab('patchNotes')}
						onOpenAbout={() => navigateToTab('about')}
						onBack={() => navigateToTab('menu')}
					/>
				)}
				{activeTab === 'settingsGeneral' && (
					<MobileSettingsGeneral onBack={() => navigateToTab('settings')} />
				)}
				{activeTab === 'settingsAppearance' && (
					<MobileSettingsAppearance onBack={() => navigateToTab('settings')} onOpenThemes={() => navigateToTab('themes')} />
				)}
				{activeTab === 'settingsData' && (
					<MobileSettingsData onBack={() => navigateToTab('settings')} />
				)}
				{activeTab === 'settingsLearn' && (
					<MobileSettingsLearn
						onStartTour={handleStartTour}
						onRestartOnboarding={handleRestartOnboarding}
						onStartTutorial={handleStartTutorial}
						onBack={() => navigateToTab('settings')}
					/>
				)}
				{activeTab === 'themes' && (
					<MobileThemes onBack={() => navigateToTab('settingsAppearance')} onOpenEditor={() => navigateToTab('themeEditor')} />
				)}
				{activeTab === 'themeEditor' && (
					<MobileThemeEditor onBack={() => navigateToTab('themes')} />
				)}
				{activeTab === 'about' && (
					<MobileAbout onBack={() => navigateToTab('settings')} />
				)}
				{activeTab === 'patchNotes' && (
					<MobilePatchNotes onBack={() => navigateToTab('settings')} />
				)}
				{activeTab === 'addCard' && character && (
					<MobileAddCard
						onBack={() => navigateToTab('sheet')}
						onConfirm={handleConfirmCard}
						mode={cardToEdit ? 'edit' : 'create'}
						cardData={cardToEdit ?? undefined}
						game={character.game}
					/>
				)}
			</div>

			{/* Navigation - Hidden when reordering cards or while a full-screen chrome tab is open. */}
			{!isReorderingCards && !CHROME_TABS.has(activeTab) && (
				!isMobileFABMode ? (
					<MobileBottomTabs
						activeTab={activeTab as NavigationTabId}
						onTabChange={navigateToTab}
						isToolbeltOpen={isToolbeltOpen}
						onToggleToolbelt={() => setIsToolbeltOpen((open) => !open)}
						isMainMenu={isMainMenu}
					/>
				) : (
					<MobileFAB
						activeTab={activeTab as NavigationTabId}
						onTabChange={navigateToTab}
						onOpenDrawer={handleOpenDrawer}
						onOpenMenu={handleOpenMenu}
						onOpenSettings={handleOpenSettings}
						sheetActiveTab={activeTab === 'sheet' ? sheetActiveTab : undefined}
						isToolbeltOpen={isToolbeltOpen}
						isExpanded={isMenuFABExpanded}
						onIsExpandedChange={setIsMenuFABExpanded}
					/>
				)
			)}

			{/* App-wide dice tray (shared with desktop); overlays any tab, opened from the toolbelt. */}
			<MobileDiceTraySheet />

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
