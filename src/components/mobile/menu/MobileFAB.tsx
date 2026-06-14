// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Menu, X, FolderOpen, Home, Settings } from 'lucide-react';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getFloatingBottom } from '@/lib/utils/mobileFloating';

type TabId = 'sheet' | 'drawer' | 'menu';
type SheetTab = 'trackers' | 'cards';

interface MobileFABProps {
	activeTab: TabId;
	onTabChange: (tab: TabId) => void;
	onOpenDrawer: () => void;
	onOpenMenu: () => void;
	sheetActiveTab?: SheetTab;
	isToolbeltOpen?: boolean;
	isExpanded?: boolean;
	onIsExpandedChange?: (isExpanded: boolean) => void;
}

export default function MobileFAB({
	activeTab,
	onTabChange,
	onOpenDrawer,
	onOpenMenu,
	sheetActiveTab,
	isToolbeltOpen,
	isExpanded: controlledIsExpanded,
	onIsExpandedChange
}: MobileFABProps) {
	const { t } = useTranslation();
	const [internalIsExpanded, setInternalIsExpanded] = useState(false);

	// Use controlled state if provided, otherwise use internal state
	const isExpanded = controlledIsExpanded ?? internalIsExpanded;
	const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
	const isLeft = mobileHandedness === 'left';

	// On the cards tab (collapsed), the FAB rides above the card navigation bar.
	const isCardsFab = !isExpanded && activeTab === 'sheet' && sheetActiveTab === 'cards';

	// On the drawer tab (collapsed), the FAB rides above the drawer's bottom toolbar.
	const isDrawerFab = !isExpanded && activeTab === 'drawer';

	const toggleExpanded = () => {
		const newValue = !isExpanded;
		setInternalIsExpanded(newValue);
		onIsExpandedChange?.(newValue);
	};

	const actions = [
		{
			id: 'sheet',
			label: t('MobileFAB.sheet'),
			icon: Home,
			onClick: () => {
				onTabChange('sheet');
				toggleExpanded();
			},
			show: true,
			active: activeTab === 'sheet',
		},
		{
			id: 'drawer',
			label: t('MobileFAB.drawer'),
			icon: FolderOpen,
			onClick: () => {
				onOpenDrawer();
				toggleExpanded();
			},
			show: true,
			active: activeTab === 'drawer',
		},
		{
			id: 'menu',
			label: t('MobileFAB.menu'),
			icon: Settings,
			onClick: () => {
				onOpenMenu();
				toggleExpanded();
			},
			show: true,
			active: activeTab === 'menu',
		},
	].filter(action => action.show);

	return (
		<>
			{/* Backdrop */}
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-background/80 backdrop-blur-sm layer-backdrop"
						onClick={toggleExpanded}
					/>
				)}
			</AnimatePresence>

			{/* Action Buttons */}
			<div
				className={cn(
					"fixed layer-panel flex flex-col-reverse gap-3",
					isLeft ? "left-4 items-start" : "right-4 items-end"
				)}
				style={{ bottom: getFloatingBottom({ extraRem: 4 }) }}
			>
				<AnimatePresence>
					{isExpanded && actions.map((action, index) => {
						const Icon = action.icon;
						return (
							<motion.button
								key={action.id}
								data-tutorial={`fab-${action.id}`}
								initial={{ opacity: 0, scale: 0, y: 20 }}
								animate={{ opacity: 1, scale: 1, y: 0 }}
								exit={{ opacity: 0, scale: 0, y: 20 }}
								transition={{
									duration: 0.2,
									delay: index * 0.05,
								}}
								onClick={action.onClick}
								className={cn(
									"flex items-center gap-3 rounded-full shadow-lg",
									"px-4 py-3 min-w-max",
									"active:scale-95 transition-transform",
									action.active
										? "bg-primary text-primary-foreground"
										: "bg-card text-foreground border border-border"
								)}
							>
								<Icon className="h-5 w-5" />
								<span className="text-sm font-medium">{action.label}</span>
							</motion.button>
						);
					})}
				</AnimatePresence>
			</div>

			{/* Primary FAB - Hide when toolbelt is open */}
			{!isToolbeltOpen && (
				<motion.div
					className={cn(
						// Single resting inset on every tab. The card yields room for the FAB
						// on the cards tab (see MobileCardArea's FAB_CLEARANCE_SHIFT) instead of
						// the FAB hopping inward here, so it no longer shifts between tabs.
						"fixed layer-panel",
						isLeft ? "left-4" : "right-4"
					)}
					style={{ bottom: getFloatingBottom({ clearsCardsNavBar: isCardsFab, clearsDrawerToolbar: isDrawerFab }) }}
					whileTap={{ scale: 0.95 }}
					data-tutorial="mobile-fab"
				>
					<IconButton
						variant="default"
						size="lg"
						onClick={toggleExpanded}
						className="h-11 w-11 shadow-2xl"
						aria-label={isExpanded ? t('MobileFAB.close') : t('MobileFAB.open')}
					>
						<motion.div
							animate={{ rotate: isExpanded ? 90 : 0 }}
							transition={{ duration: 0.2 }}
						>
							{isExpanded ? (
								<X className="h-6 w-6" />
							) : (
								<Menu className="h-6 w-6" />
							)}
						</motion.div>
					</IconButton>
				</motion.div>
			)}
		</>
	);
}
