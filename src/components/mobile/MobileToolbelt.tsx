// -- Component Imports --
import ToolbeltSidePanel from './ToolbeltSidePanel';
import ToolbeltFAB from './ToolbeltFAB';

// -- Hook Imports --
import { useToolbeltActions } from '@/hooks/useToolbeltActions';

// -- Type Imports --
import type { ToolbeltMode, ToolbeltContext } from '@/lib/types/toolbelt';

interface MobileToolbeltProps {
	mode: ToolbeltMode;
	context: ToolbeltContext;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function MobileToolbelt({
	mode,
	context,
	isOpen,
	onOpenChange
}: MobileToolbeltProps) {
	// Build action list based on context
	const actions = useToolbeltActions(context);

	// Render appropriate UI based on mode
	if (mode === 'side-panel') {
		return (
			<ToolbeltSidePanel
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				actions={actions}
			/>
		);
	}

	// FAB mode
	return (
		<ToolbeltFAB
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			actions={actions}
		/>
	);
}
