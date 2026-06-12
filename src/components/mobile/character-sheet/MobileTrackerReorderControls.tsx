// -- Component Imports --
import { IconButton } from '@/components/ui/icon-button';

// -- Icon Imports --
import { ChevronUp, ChevronDown, SquareDashed } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface MobileTrackerReorderControlsProps {
	isLeftHanded: boolean;
	onDeselect: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	canMoveUp: boolean;
	canMoveDown: boolean;
}

/**
 * The floating tracker-reorder control cluster, shown when a tracker is selected
 * on the trackers tab: a deselect button plus up/down move buttons. Positioned
 * bottom-left for left-handed users and bottom-right otherwise. Purely
 * presentational - selection/move callbacks and the can-move flags come from the
 * sheet's tracker-reorder hook; the handedness placement is preserved.
 */
export function MobileTrackerReorderControls({ isLeftHanded, onDeselect, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: MobileTrackerReorderControlsProps) {
	return (
		<div className={cn(
			"fixed bottom-32 z-25 flex flex-col gap-2",
			isLeftHanded ? "left-4" : "right-4"
		)}>
			<IconButton
				variant="default"
				size="lg"
				onClick={onDeselect}
				className="h-10 w-10 shadow-2xl"
			>
				<SquareDashed className="h-6 w-6" />
			</IconButton>
			<IconButton
				variant="default"
				size="lg"
				onClick={onMoveUp}
				disabled={!canMoveUp}
				className="h-10 w-10 shadow-2xl"
			>
				<ChevronUp className="h-6 w-6" />
			</IconButton>
			<IconButton
				variant="default"
				size="lg"
				onClick={onMoveDown}
				disabled={!canMoveDown}
				className="h-10 w-10 shadow-2xl"
			>
				<ChevronDown className="h-6 w-6" />
			</IconButton>
		</div>
	);
}
