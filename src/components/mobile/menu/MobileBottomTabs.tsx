// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Home, FolderOpen, MoreHorizontal, Edit } from 'lucide-react';

// -- Store Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useCharacterStore } from '@/lib/stores/characterStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';

type TabId = 'sheet' | 'drawer' | 'menu';

interface MobileBottomTabsProps {
	activeTab: TabId;
	onTabChange: (tab: TabId) => void;
}

export default function MobileBottomTabs({ activeTab, onTabChange }: MobileBottomTabsProps) {
	const { t } = useTranslation();
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const { toggleIsEditing } = useAppGeneralStateActions();
	const character = useCharacterStore((state) => state.character);

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

				{/* Edit Mode Toggle - Only visible when character is loaded */}
				{character && (
					<button
						onClick={toggleIsEditing}
						className={cn(
							"flex flex-col items-center justify-center flex-1 h-full transition-colors",
							"active:bg-muted/50",
							isEditing
								? "text-primary"
								: "text-muted-foreground hover:text-foreground"
						)}
						aria-label={t('MobileBottomTabs.edit')}
					>
						<Edit className="h-6 w-6 mb-1" />
						<span className="text-xs font-medium">
							{t('MobileBottomTabs.edit')}
						</span>
					</button>
				)}
			</div>
		</div>
	);
}
