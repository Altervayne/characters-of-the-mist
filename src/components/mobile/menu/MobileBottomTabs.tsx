// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Home, FolderOpen, MoreHorizontal, Wrench } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

type TabId = 'sheet' | 'drawer' | 'menu';

interface MobileBottomTabsProps {
	activeTab: TabId;
	onTabChange: (tab: TabId) => void;
	/** Whether the toolbelt side-panel is currently open. */
	isToolbeltOpen: boolean;
	/** Toggles the toolbelt side-panel open/closed. */
	onToggleToolbelt: () => void;
	/** True when the sheet tab is showing the main menu (no character loaded). */
	isMainMenu?: boolean;
}

export default function MobileBottomTabs({ activeTab, onTabChange, isToolbeltOpen, onToggleToolbelt, isMainMenu = false }: MobileBottomTabsProps) {
	const { t } = useTranslation();

	// The toolbelt only operates on the character sheet, so its trigger is
	// disabled (and visually grayed) on every other tab - including the main
	// menu the sheet tab shows when no character is loaded.
	const isToolbeltAvailable = activeTab === 'sheet' && !isMainMenu;

	const tabs = [
		{
			id: 'sheet' as TabId,
			label: t('MobileBottomTabs.sheet'),
			icon: Home,
		},
		{
			id: 'drawer' as TabId,
			label: t('MobileBottomTabs.drawer'),
			icon: FolderOpen,
		},
		{
			id: 'menu' as TabId,
			label: t('MobileBottomTabs.menu'),
			icon: MoreHorizontal,
		},
	];

	return (
		<div className="shrink-0 bg-card border-t border-border pb-safe" data-tutorial="bottom-tabs">
			<div className="flex items-center justify-around h-16">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.id;

					return (
						<button
							key={tab.id}
							onClick={() => onTabChange(tab.id)}
							data-tutorial={`${tab.id}-tab`}
							className={cn(
								"flex flex-col items-center justify-center flex-1 h-full transition-colors",
								"active:bg-muted/50",
								isActive
									? "text-primary"
									: "text-muted-foreground hover:text-foreground"
							)}
							aria-label={tab.label}
						>
							<Icon className="h-6 w-6 mb-1" />
							<span className="text-xs font-medium">{tab.label}</span>
						</button>
					);
				})}

				{/* Toolbelt Toggle - Disabled outside the character sheet, where it has nothing to act on */}
				<button
					onClick={onToggleToolbelt}
					disabled={!isToolbeltAvailable}
					className={cn(
						"flex flex-col items-center justify-center flex-1 h-full transition-colors",
						isToolbeltAvailable
							? cn(
								"active:bg-muted/50",
								isToolbeltOpen
									? "text-primary"
									: "text-muted-foreground hover:text-foreground"
							)
							: "text-muted-foreground/40 cursor-not-allowed"
					)}
					aria-label={t('MobileBottomTabs.toolbelt')}
				>
					<Wrench className="h-6 w-6 mb-1" />
					<span className="text-xs font-medium">
						{t('MobileBottomTabs.toolbelt')}
					</span>
				</button>
			</div>
		</div>
	);
}
