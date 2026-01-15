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

type TabId = 'sheet' | 'drawer' | 'menu';
type SheetTab = 'trackers' | 'cards';

interface MobileFABProps {
	activeTab: TabId;
	onTabChange: (tab: TabId) => void;
	onOpenDrawer: () => void;
	onOpenMenu: () => void;
	sheetActiveTab?: SheetTab;
	isToolbeltOpen?: boolean;
	onIsExpandedChange?: (isExpanded: boolean) => void;
}

export default function MobileFAB({
	activeTab,
	onTabChange,
	onOpenDrawer,
	onOpenMenu,
	sheetActiveTab,
	isToolbeltOpen,
	onIsExpandedChange
}: MobileFABProps) {
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(false);
	const mobileHandedness = useAppSettingsStore((state) => state.mobileHandedness);
	const isLeft = mobileHandedness === 'left';

	const toggleExpanded = () => {
		const newValue = !isExpanded;
		setIsExpanded(newValue);
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
						className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
						onClick={toggleExpanded}
					/>
				)}
			</AnimatePresence>

			{/* Action Buttons */}
			<div className={cn(
				"fixed bottom-20 z-50 flex flex-col-reverse gap-3",
				isLeft ? "left-4 items-start" : "right-4 items-end"
			)}>
				<AnimatePresence>
					{isExpanded && actions.map((action, index) => {
						const Icon = action.icon;
						return (
							<motion.button
								key={action.id}
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
						"fixed z-50",
						isExpanded
							? isLeft ? "bottom-4 left-4" : "bottom-4 right-4"
							: activeTab === 'sheet' && sheetActiveTab === 'cards'
								? isLeft ? "bottom-14 left-2" : "bottom-14 right-2"
								: isLeft ? "bottom-4 left-4" : "bottom-4 right-4"
					)}
					whileTap={{ scale: 0.95 }}
				>
					<IconButton
						variant="default"
						size="lg"
						onClick={toggleExpanded}
						className="h-10 w-10 shadow-2xl"
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
