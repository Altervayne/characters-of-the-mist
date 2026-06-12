// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { Wrench } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



type SheetTab = 'trackers' | 'cards';

interface MobileCharacterSheetTabBarProps {
	activeTab: SheetTab;
	onTabChange: (tab: SheetTab) => void;
	cardCount: number;
	isMobileFABMode: boolean;
	isLeftHanded: boolean;
	onOpenToolbelt: () => void;
}

/**
 * The trackers/cards tab bar for the mobile character sheet. Renders the two tab
 * buttons (the cards tab showing a count badge) and, in side-panel mode, the
 * toolbelt trigger placed on the left for left-handed users and the right
 * otherwise. Purely presentational - active tab, counts, mode/handedness, and the
 * change/open callbacks all come from the sheet.
 */
export function MobileCharacterSheetTabBar({ activeTab, onTabChange, cardCount, isMobileFABMode, isLeftHanded, onOpenToolbelt }: MobileCharacterSheetTabBarProps) {
	const { t } = useTranslation();

	return (
		<div className="flex items-center border-b border-border bg-card">
			{/* Toolbelt trigger button (left side for left-handed) */}
			{!isMobileFABMode && isLeftHanded && (
				<div className="px-2">
					<IconButton
						variant="ghost"
						size="sm"
						onClick={onOpenToolbelt}
						aria-label="Open actions"
						className="h-8 w-8"
					>
						<Wrench className="h-4 w-4" />
					</IconButton>
				</div>
			)}

			<button
				onClick={() => onTabChange('trackers')}
				data-tutorial="trackers-tab"
				className={cn(
					"flex-1 px-4 py-3 text-sm font-medium transition-colors",
					"border-b-2",
					activeTab === 'trackers'
						? "border-primary text-primary bg-primary/5"
						: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
				)}
			>
				{t('MobileCharacterSheet.trackersTab')}
			</button>
			<button
				onClick={() => onTabChange('cards')}
				data-tutorial="cards-tab"
				className={cn(
					"flex-1 px-4 py-3 text-sm font-medium transition-colors",
					"border-b-2",
					activeTab === 'cards'
						? "border-primary text-primary bg-primary/5"
						: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
				)}
			>
				{t('MobileCharacterSheet.cardsTab')}
				{cardCount > 0 && (
					<span className="ml-2 text-xs text-muted-foreground">
						({cardCount})
					</span>
				)}
			</button>

			{/* Toolbelt trigger button (right side for right-handed) */}
			{!isMobileFABMode && !isLeftHanded && (
				<div className="px-2">
					<IconButton
						variant="ghost"
						size="sm"
						onClick={onOpenToolbelt}
						aria-label="Open actions"
						className="h-8 w-8"
					>
						<Wrench className="h-4 w-4" />
					</IconButton>
				</div>
			)}
		</div>
	);
}
