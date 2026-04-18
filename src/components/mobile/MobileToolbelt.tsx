// -- Component Imports --
import ToolbeltSidePanel from './ToolbeltSidePanel';
import ToolbeltFAB from './ToolbeltFAB';

// -- Hook Imports --
import { useToolbeltActions } from '@/hooks/useToolbeltActions';

// -- Type Imports --
import type { ToolbeltMode, ToolbeltContext } from '@/lib/types/toolbelt';
import type { Card, Tracker } from '@/lib/types/character';

type SheetTab = 'trackers' | 'cards';

interface MobileToolbeltProps {
	mode: ToolbeltMode;
	context: ToolbeltContext;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	activeTab?: SheetTab;
	isMenuFABExpanded?: boolean;
	onEnterCardReorderMode?: () => void;
	onOpenAddCard?: () => void;
	onSaveToDrawer?: (item: Card | Tracker) => void;
}

export default function MobileToolbelt({
	mode,
	context,
	isOpen,
	onOpenChange,
	activeTab,
	isMenuFABExpanded,
	onEnterCardReorderMode,
	onOpenAddCard,
	onSaveToDrawer
}: MobileToolbeltProps) {
	// Build action lists based on context and active tab
	const { itemActions, globalActions } = useToolbeltActions(context, activeTab, onEnterCardReorderMode, onOpenAddCard, onSaveToDrawer);

	// Render appropriate UI based on mode
	if (mode === 'side-panel') {
		return (
			<ToolbeltSidePanel
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				itemActions={itemActions}
				globalActions={globalActions}
			/>
		);
	}

	// FAB mode
	return (
		<ToolbeltFAB
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			itemActions={itemActions}
			globalActions={globalActions}
			activeTab={activeTab}
			isMenuFABExpanded={isMenuFABExpanded}
		/>
	);
}
