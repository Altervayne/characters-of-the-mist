// Mobile Tutorial Step Definitions
// Defines each step of the mobile tutorial flow

export interface TutorialStep {
	id: string;
	selector?: string;           // CSS selector for target element (data-tutorial attribute)
	titleKey: string;            // i18n translation key for title
	descriptionKey: string;      // i18n translation key for description
	position?: 'top' | 'bottom' | 'center'; // Tooltip position preference
	onEnter?: () => void;        // Action to execute when entering step
	waitForAction?: boolean;     // Wait for user action before allowing next
	highlightPadding?: number;   // Extra padding around highlighted element
}

export interface TutorialActions {
	navigateToTab: (tab: 'sheet' | 'drawer' | 'menu') => void;
	setSheetTab: (tab: 'trackers' | 'cards') => void;
	openSettings: () => void;
	closeSettings: () => void;
	expandFAB?: () => void;
	collapseFAB?: () => void;
}

export function getMobileTutorialSteps(actions: TutorialActions, isFABMode: boolean): TutorialStep[] {
	if (isFABMode) {
		return getFABModeSteps(actions);
	}
	return getNavbarModeSteps(actions);
}

// Tutorial steps for Navbar mode (bottom tabs + side panel toolbelt)
function getNavbarModeSteps(actions: TutorialActions): TutorialStep[] {
	return [
		// Step 1: Intro - Full screen welcome
		{
			id: 'intro',
			titleKey: 'MobileTutorial.intro.title',
			descriptionKey: 'MobileTutorial.intro.description',
			position: 'center',
		},

		// Step 2: Navigation - Bottom tabs overview
		{
			id: 'navigation',
			selector: '[data-tutorial="bottom-tabs"]',
			titleKey: 'MobileTutorial.navigation.title',
			descriptionKey: 'MobileTutorial.navigation.tabs.description',
			position: 'top',
			highlightPadding: 8,
			onEnter: () => actions.navigateToTab('sheet'),
		},

		// Step 3: Sheet Tab - Show character sheet
		{
			id: 'sheet',
			selector: '[data-tutorial="sheet-tab"]',
			titleKey: 'MobileTutorial.sheet.title',
			descriptionKey: 'MobileTutorial.sheet.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('sheet'),
		},

		// Step 4: Trackers - Explain trackers area
		{
			id: 'trackers',
			selector: '[data-tutorial="trackers-section"]',
			titleKey: 'MobileTutorial.trackers.title',
			descriptionKey: 'MobileTutorial.trackers.description',
			position: 'bottom',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('trackers');
			},
		},

		// Step 5: Tracker Selection - Explain long-press to select
		{
			id: 'trackerSelection',
			selector: '[data-tutorial="trackers-section"]',
			titleKey: 'MobileTutorial.trackerSelection.title',
			descriptionKey: 'MobileTutorial.trackerSelection.description',
			position: 'bottom',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('trackers');
			},
		},

		// Step 6: Toolbelt - Show action toolbelt (side panel)
		{
			id: 'toolbelt',
			selector: '[data-tutorial="toolbelt"]',
			titleKey: 'MobileTutorial.toolbelt.title',
			descriptionKey: 'MobileTutorial.toolbelt.sidePanel.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('trackers');
			},
		},

		// Step 7: Cards Tab - Switch to cards
		{
			id: 'cards',
			selector: '[data-tutorial="cards-tab"]',
			titleKey: 'MobileTutorial.cards.title',
			descriptionKey: 'MobileTutorial.cards.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('sheet'),
		},

		// Step 8: Card Navigation Bar - Explain navigation
		{
			id: 'cardNavigation',
			selector: '[data-tutorial="card-navigation-bar"]',
			titleKey: 'MobileTutorial.cardNavigation.title',
			descriptionKey: 'MobileTutorial.cardNavigation.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('cards');
			},
		},

		// Step 9: Drawer Tab - Show drawer
		{
			id: 'drawer',
			selector: '[data-tutorial="drawer-tab"]',
			titleKey: 'MobileTutorial.drawer.title',
			descriptionKey: 'MobileTutorial.drawer.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('sheet'),
		},

		// Step 10: Drawer Content - Explain drawer contents
		{
			id: 'drawerContent',
			selector: '[data-tutorial="drawer-content"]',
			titleKey: 'MobileTutorial.drawerContent.title',
			descriptionKey: 'MobileTutorial.drawerContent.description',
			position: 'bottom',
			onEnter: () => actions.navigateToTab('drawer'),
		},

		// Step 11: Drawer Interactions - How to interact with items
		{
			id: 'drawerInteractions',
			selector: '[data-tutorial="drawer-content"]',
			titleKey: 'MobileTutorial.drawerInteractions.title',
			descriptionKey: 'MobileTutorial.drawerInteractions.description',
			position: 'bottom',
			onEnter: () => actions.navigateToTab('drawer'),
		},

		// Step 12: Drawer Toolbar - Show drawer actions
		{
			id: 'drawerToolbar',
			selector: '[data-tutorial="drawer-toolbar"]',
			titleKey: 'MobileTutorial.drawerToolbar.title',
			descriptionKey: 'MobileTutorial.drawerToolbar.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('drawer'),
		},

		// Step 13: Menu Tab - Show menu
		{
			id: 'menu',
			selector: '[data-tutorial="menu-tab"]',
			titleKey: 'MobileTutorial.menu.title',
			descriptionKey: 'MobileTutorial.menu.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('drawer'),
		},

		// Step 14: Menu Actions - Explain menu options
		{
			id: 'menuActions',
			selector: '[data-tutorial="menu-content"]',
			titleKey: 'MobileTutorial.menuActions.title',
			descriptionKey: 'MobileTutorial.menuActions.description',
			position: 'bottom',
			onEnter: () => actions.navigateToTab('menu'),
		},

		// Step 15: Complete - Wrap up
		{
			id: 'complete',
			titleKey: 'MobileTutorial.complete.title',
			descriptionKey: 'MobileTutorial.complete.description',
			position: 'center',
		},
	];
}

// Tutorial steps for FAB mode (floating action button + FAB toolbelt)
function getFABModeSteps(actions: TutorialActions): TutorialStep[] {
	return [
		// Step 1: Intro - Full screen welcome
		{
			id: 'intro',
			titleKey: 'MobileTutorial.intro.title',
			descriptionKey: 'MobileTutorial.intro.description',
			position: 'center',
		},

		// Step 2: Navigation - FAB button overview
		{
			id: 'navigation',
			selector: '[data-tutorial="mobile-fab"]',
			titleKey: 'MobileTutorial.navigation.title',
			descriptionKey: 'MobileTutorial.navigation.fab.description',
			position: 'top',
			highlightPadding: 8,
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.collapseFAB?.();
			},
		},

		// Step 3: Sheet option in FAB
		{
			id: 'sheet',
			selector: '[data-tutorial="fab-sheet"]',
			titleKey: 'MobileTutorial.sheet.title',
			descriptionKey: 'MobileTutorial.sheet.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.expandFAB?.();
			},
		},

		// Step 4: Trackers - Explain trackers area
		{
			id: 'trackers',
			selector: '[data-tutorial="trackers-section"]',
			titleKey: 'MobileTutorial.trackers.title',
			descriptionKey: 'MobileTutorial.trackers.description',
			position: 'bottom',
			onEnter: () => {
				actions.collapseFAB?.();
				actions.navigateToTab('sheet');
				actions.setSheetTab('trackers');
			},
		},

		// Step 5: Tracker Selection - Explain long-press to select
		{
			id: 'trackerSelection',
			selector: '[data-tutorial="trackers-section"]',
			titleKey: 'MobileTutorial.trackerSelection.title',
			descriptionKey: 'MobileTutorial.trackerSelection.description',
			position: 'bottom',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('trackers');
			},
		},

		// Step 6: Toolbelt - Show action toolbelt (FAB)
		{
			id: 'toolbelt',
			selector: '[data-tutorial="toolbelt"]',
			titleKey: 'MobileTutorial.toolbelt.title',
			descriptionKey: 'MobileTutorial.toolbelt.fab.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('trackers');
			},
		},

		// Step 7: Cards Tab - Switch to cards
		{
			id: 'cards',
			selector: '[data-tutorial="cards-tab"]',
			titleKey: 'MobileTutorial.cards.title',
			descriptionKey: 'MobileTutorial.cards.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('sheet'),
		},

		// Step 8: Card Navigation Bar - Explain navigation
		{
			id: 'cardNavigation',
			selector: '[data-tutorial="card-navigation-bar"]',
			titleKey: 'MobileTutorial.cardNavigation.title',
			descriptionKey: 'MobileTutorial.cardNavigation.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.setSheetTab('cards');
			},
		},

		// Step 9: Drawer option in FAB
		{
			id: 'drawer',
			selector: '[data-tutorial="fab-drawer"]',
			titleKey: 'MobileTutorial.drawer.title',
			descriptionKey: 'MobileTutorial.drawer.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('sheet');
				actions.expandFAB?.();
			},
		},

		// Step 10: Drawer Content - Explain drawer contents
		{
			id: 'drawerContent',
			selector: '[data-tutorial="drawer-content"]',
			titleKey: 'MobileTutorial.drawerContent.title',
			descriptionKey: 'MobileTutorial.drawerContent.description',
			position: 'bottom',
			onEnter: () => {
				actions.collapseFAB?.();
				actions.navigateToTab('drawer');
			},
		},

		// Step 11: Drawer Interactions - How to interact with items
		{
			id: 'drawerInteractions',
			selector: '[data-tutorial="drawer-content"]',
			titleKey: 'MobileTutorial.drawerInteractions.title',
			descriptionKey: 'MobileTutorial.drawerInteractions.description',
			position: 'bottom',
			onEnter: () => actions.navigateToTab('drawer'),
		},

		// Step 12: Drawer Toolbar - Show drawer actions
		{
			id: 'drawerToolbar',
			selector: '[data-tutorial="drawer-toolbar"]',
			titleKey: 'MobileTutorial.drawerToolbar.title',
			descriptionKey: 'MobileTutorial.drawerToolbar.description',
			position: 'top',
			onEnter: () => actions.navigateToTab('drawer'),
		},

		// Step 13: Menu option in FAB
		{
			id: 'menu',
			selector: '[data-tutorial="fab-menu"]',
			titleKey: 'MobileTutorial.menu.title',
			descriptionKey: 'MobileTutorial.menu.description',
			position: 'top',
			onEnter: () => {
				actions.navigateToTab('drawer');
				actions.expandFAB?.();
			},
		},

		// Step 14: Menu Actions - Explain menu options
		{
			id: 'menuActions',
			selector: '[data-tutorial="menu-content"]',
			titleKey: 'MobileTutorial.menuActions.title',
			descriptionKey: 'MobileTutorial.menuActions.description',
			position: 'bottom',
			onEnter: () => {
				actions.collapseFAB?.();
				actions.navigateToTab('menu');
			},
		},

		// Step 15: Complete - Wrap up
		{
			id: 'complete',
			titleKey: 'MobileTutorial.complete.title',
			descriptionKey: 'MobileTutorial.complete.description',
			position: 'center',
		},
	];
}
