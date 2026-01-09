// Mobile Character Sheet Page
// Main mobile page that orchestrates the mobile experience

// -- React Imports --
import { useState, useEffect, useRef, startTransition } from 'react';

// -- Component Imports --
import MobileCharacterSheet from './MobileCharacterSheet';
import MobileBottomTabs from './MobileBottomTabs';
import MobileFAB from './MobileFAB';
import MobileMenu from './MobileMenu';
import MobileSettings from './MobileSettings';
import MobileAbout from './MobileAbout';
import MobilePatchNotes from './MobilePatchNotes';
import MobileMainMenu from './MobileMainMenu';
import MobileAddCard from './MobileAddCard';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';

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

	// Card creation state
	const { addCard } = useCharacterActions();
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
		// TODO: Implement tour for mobile
		console.log('Tour not yet implemented for mobile');
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

	const handleConfirmCard = (options: CreateCardOptions) => {
		const cardId = addCard(options);
		setCardToEdit(null);
		setNewlyCreatedCardId(cardId);
		navigateToTab('sheet');
		navigateToSheetTab('cards');
	};

	// If no character is loaded, show the main menu
	if (!character) {
		return (
			<div className="h-screen w-screen overflow-hidden">
				<MobileMainMenu onOpenDrawer={handleOpenDrawer} />
			</div>
		);
	}

	return (
		<div className="h-screen w-screen overflow-hidden flex flex-col">
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
						initialCardId={newlyCreatedCardId}
					/>
				)}
				{activeTab === 'drawer' && (
					<div className="h-full flex items-center justify-center p-8 text-center">
						<p className="text-muted-foreground">DRAWER PLACEHOLDER</p>
					</div>
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
					<MobileBottomTabs activeTab={activeTab as NavigationTabId} onTabChange={navigateToTab} />
				) : (
					<MobileFAB
						activeTab={activeTab as NavigationTabId}
						onTabChange={navigateToTab}
						onOpenDrawer={handleOpenDrawer}
						onOpenMenu={handleOpenMenu}
						sheetActiveTab={activeTab === 'sheet' ? sheetActiveTab : undefined}
						isToolbeltOpen={isToolbeltOpen}
						onIsExpandedChange={setIsMenuFABExpanded}
					/>
				)
			)}

		</div>
	);
}
