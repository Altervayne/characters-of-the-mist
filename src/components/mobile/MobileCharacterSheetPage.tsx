// Mobile Character Sheet Page
// Main mobile page that orchestrates the mobile experience

// -- React Imports --
import { useState, useEffect, useRef } from 'react';

// -- Component Imports --
import MobileCharacterSheet from './MobileCharacterSheet';
import MobileBottomTabs from './MobileBottomTabs';
import MobileFAB from './MobileFAB';
import MobileMenu from './MobileMenu';
import MobileSettings from './MobileSettings';
import { InfoDialog } from '@/components/organisms/info-dialog';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

type TabId = 'sheet' | 'drawer' | 'menu' | 'settings';
type SheetTab = 'trackers' | 'cards';

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

	// Track if we're handling a popstate event to avoid pushing duplicate history
	const isNavigatingBack = useRef(false);

	// Dialog states
	const isSettingsOpen = useAppGeneralStateStore((state) => state.isSettingsOpen);
	const isInfoOpen = useAppGeneralStateStore((state) => state.isInfoOpen);
	const { setSettingsOpen, setInfoOpen } = useAppGeneralStateActions();

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
		// TODO: Implement tour for mobile if needed
		console.log('Tour not yet implemented for mobile');
	};

	const handleOpenDrawer = () => {
		navigateToTab('drawer');
		// TODO: Implement drawer opening in Phase 4
	};

	const handleOpenMenu = () => {
		navigateToTab('menu');
	};

	const handleOpenSettings = () => {
		navigateToTab('settings');
		if (isSettingsOpen) {
			setSettingsOpen(false); // Close the dialog state if it was open
		}
	};

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
					/>
				)}
				{activeTab === 'drawer' && (
					<div className="h-full flex items-center justify-center p-8 text-center">
						<p className="text-muted-foreground">DRAWER PLACEHOLDER</p>
					</div>
				)}
				{activeTab === 'menu' && <MobileMenu onOpenSettings={handleOpenSettings} />}
				{activeTab === 'settings' && (
					<MobileSettings
						onStartTour={handleStartTour}
						onBack={() => navigateToTab('menu')}
					/>
				)}
			</div>

			{/* Navigation - Hidden when reordering cards or in settings */}
			{!isReorderingCards && activeTab !== 'settings' && (
				!isMobileFABMode ? (
					<MobileBottomTabs activeTab={activeTab} onTabChange={navigateToTab} />
				) : (
					<MobileFAB
						activeTab={activeTab}
						onTabChange={navigateToTab}
						onOpenDrawer={handleOpenDrawer}
						onOpenMenu={handleOpenMenu}
						sheetActiveTab={activeTab === 'sheet' ? sheetActiveTab : undefined}
						isToolbeltOpen={isToolbeltOpen}
						onIsExpandedChange={setIsMenuFABExpanded}
					/>
				)
			)}

			{/* Dialogs */}
			<InfoDialog
				isOpen={isInfoOpen}
				onOpenChange={setInfoOpen}
			/>
		</div>
	);
}
