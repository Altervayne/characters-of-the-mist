// Mobile Character Sheet Page
// Main mobile page that orchestrates the mobile experience

// -- React Imports --
import { useState } from 'react';

// -- Component Imports --
import MobileCharacterSheet from './MobileCharacterSheet';
import MobileBottomTabs from './MobileBottomTabs';
import MobileFAB from './MobileFAB';
import MobileMenu from './MobileMenu';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

type TabId = 'sheet' | 'drawer' | 'menu';

export default function MobileCharacterSheetPage() {
	const [activeTab, setActiveTab] = useState<TabId>('sheet');
	const mobileNavigationType = useAppSettingsStore((state) => state.mobileNavigationType);

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
				{activeTab === 'sheet' && <MobileCharacterSheet />}
				{activeTab === 'drawer' && (
					<div className="h-full flex items-center justify-center p-8 text-center">
						<p className="text-muted-foreground">DRAWER PLACEHOLDER</p>
					</div>
				)}
				{activeTab === 'menu' && <MobileMenu />}
			</div>

			{/* Navigation */}
			{mobileNavigationType === 'bottom-tabs' ? (
				<MobileBottomTabs activeTab={activeTab} onTabChange={setActiveTab} />
			) : (
				<MobileFAB onOpenDrawer={handleOpenDrawer} onOpenMenu={handleOpenMenu} />
			)}
		</div>
	);
}
