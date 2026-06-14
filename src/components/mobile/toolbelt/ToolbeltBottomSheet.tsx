// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { Button } from '@/components/ui/button';
import { MobileBottomSheet } from '@/components/mobile/shared/MobileBottomSheet';

// -- Icon Imports --
import { X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { ToolbeltAction } from '@/lib/types/toolbelt';



interface ToolbeltBottomSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	itemActions: ToolbeltAction[];
	globalActions: ToolbeltAction[];
}

/**
 * The side-panel-mode toolbelt presented as a compact bottom sheet.
 *
 * Replaces the old full-height side panel, which slid in over the very
 * tracker/card it acts on. Sliding up from the bottom instead keeps the selected
 * item visible above the sheet and puts the action tiles in the thumb zone. The
 * actions are laid out as a three-column grid of icon-over-label tiles, grouped
 * into the item-specific section (shown only when the context supplies item
 * actions) and the always-present global section. Tapping a tile runs its action
 * and closes the sheet. The grid scrolls within a capped height for long action
 * lists, and the content clears the home indicator via the `pb-safe` utility.
 *
 * Built on the shared {@link MobileBottomSheet} scaffold (backdrop + slide), so
 * this component owns only the toolbelt-specific chrome and tile layout. The
 * `data-tutorial="toolbelt"` anchor is preserved for the mobile tour.
 *
 * @param isOpen - Whether the sheet is shown.
 * @param onOpenChange - Called with `false` to close (backdrop tap, close button, or after running an action).
 * @param itemActions - Context-specific actions for the selected card/tracker (may be empty).
 * @param globalActions - Always-present global actions (undo/redo/edit/save/...).
 */
export default function ToolbeltBottomSheet({
	isOpen,
	onOpenChange,
	itemActions,
	globalActions,
}: ToolbeltBottomSheetProps) {
	const { t } = useTranslation();
	const hasItemActions = itemActions.length > 0;

	const renderTile = (action: ToolbeltAction) => {
		const Icon = action.icon;
		return (
			<button
				key={action.id}
				onClick={() => {
					action.onClick();
					onOpenChange(false);
				}}
				className={cn(
					"flex flex-col items-center justify-center gap-1.5 rounded-lg p-2 min-h-20 text-center transition-colors",
					action.variant === 'destructive'
						? "text-destructive hover:bg-destructive/10"
						: "text-foreground hover:bg-accent"
				)}
			>
				<Icon className="h-6 w-6 shrink-0" />
				<span className="text-xs font-medium leading-tight">{action.label}</span>
			</button>
		);
	};

	return (
		<MobileBottomSheet isOpen={isOpen} onClose={() => onOpenChange(false)}>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border">
				<h2 className="text-lg font-semibold">{t('Toolbelt.title')}</h2>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onOpenChange(false)}
					className="h-11 w-11 p-0"
				>
					<X className="h-5 w-5" />
				</Button>
			</div>

			{/* Action tiles */}
			<div
				data-tutorial="toolbelt"
				className="max-h-[55vh] overflow-y-auto p-3 pb-safe space-y-4"
			>
				{/* Item Actions Section (only when the context supplies item actions) */}
				{hasItemActions && (
					<div>
						<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-2">
							{t('Toolbelt.itemSection')}
						</h3>
						<div className="grid grid-cols-3 gap-2">
							{itemActions.map(renderTile)}
						</div>
					</div>
				)}

				{/* Global Actions Section (globalActions is always non-empty) */}
				<div>
					<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-2">
						{t('Toolbelt.globalSection')}
					</h3>
					<div className="grid grid-cols-3 gap-2">
						{globalActions.map(renderTile)}
					</div>
				</div>
			</div>
		</MobileBottomSheet>
	);
}
