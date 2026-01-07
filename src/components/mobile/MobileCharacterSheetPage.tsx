// Mobile Character Sheet Page
// Main mobile page that orchestrates the mobile experience

// -- React Imports --
import { useState } from 'react';

// -- Component Imports --
import MobileCharacterSheet from './MobileCharacterSheet';
import MobileBottomTabs from './MobileBottomTabs';
import MobileFAB from './MobileFAB';
import MobileMenu from './MobileMenu';
import { SettingsDialog } from '@/components/organisms/settings-dialog';
import { InfoDialog } from '@/components/organisms/info-dialog';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

type TabId = 'sheet' | 'drawer' | 'menu';

export default function MobileCharacterSheetPage() {
	const [activeTab, setActiveTab] = useState<TabId>('sheet');
	const [sheetActiveTab, setSheetActiveTab] = useState<'trackers' | 'cards'>('trackers');
	const [isMenuFABExpanded, setIsMenuFABExpanded] = useState(false);
	const [isToolbeltOpen, setIsToolbeltOpen] = useState(false);
	const [isReorderingCards, setIsReorderingCards] = useState(false);
	const isMobileFABMode = useAppSettingsStore((state) => state.isMobileFABMode);

	// Dialog states
	const isSettingsOpen = useAppGeneralStateStore((state) => state.isSettingsOpen);
	const isInfoOpen = useAppGeneralStateStore((state) => state.isInfoOpen);
	const { setSettingsOpen, setInfoOpen } = useAppGeneralStateActions();

	const handleStartTour = () => {
		// TODO: Implement tour for mobile if needed
		console.log('Tour not yet implemented for mobile');
	};

	const handleOpenDrawer = () => {
		setActiveTab('drawer');
		// TODO: Implement drawer opening in Phase 4
	};

	const handleOpenMenu = () => {
		setActiveTab('menu');
	};

	return (
		<div className="h-screen w-screen overflow-hidden flex flex-col">
			{/* Main Content */}
			<div className="flex-1 overflow-hidden">
				{activeTab === 'sheet' && (
					<MobileCharacterSheet
						activeTab={sheetActiveTab}
						onTabChange={setSheetActiveTab}
						isToolbeltOpen={isToolbeltOpen}
						onToolbeltOpenChange={setIsToolbeltOpen}
						isMenuFABExpanded={isMenuFABExpanded}
                  onReorderingCardsChange={setIsReorderingCards}
					/>
				)}
				{activeTab === 'drawer' && (
					<div className="h-full flex items-center justify-center p-8 text-center">
						<p className="text-muted-foreground">DRAWER PLACEHOLDER</p>
					</div>
				)}
				{activeTab === 'menu' && <MobileMenu />}
			</div>

			{/* Navigation - Hidden when reordering cards */}
			{!isReorderingCards && (
				!isMobileFABMode ? (
					<MobileBottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
				) : (
					<MobileFAB
						activeTab={activeTab}
						onTabChange={setActiveTab}
						onOpenDrawer={handleOpenDrawer}
						onOpenMenu={handleOpenMenu}
						sheetActiveTab={activeTab === 'sheet' ? sheetActiveTab : undefined}
						isToolbeltOpen={isToolbeltOpen}
						onIsExpandedChange={setIsMenuFABExpanded}
					/>
				)
			)}

			{/* Dialogs */}
			<SettingsDialog
				isOpen={isSettingsOpen}
				onOpenChange={setSettingsOpen}
				onStartTour={handleStartTour}
			/>
			<InfoDialog
				isOpen={isInfoOpen}
				onOpenChange={setInfoOpen}
			/>
		</div>
	);
}
