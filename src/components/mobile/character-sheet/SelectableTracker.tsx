// -- React Imports --
import { type ReactNode } from 'react';

// -- Icon Imports --
import { Check } from 'lucide-react';

// -- Hook Imports --
import { useLongPress } from '@/hooks/mobile/useLongPress';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { StatusTracker, StoryTagTracker, StoryThemeTracker } from '@/lib/types/character';

interface SelectableTrackerProps {
	tracker: StatusTracker | StoryTagTracker | StoryThemeTracker;
	isSelected: boolean;
	onSelect: (id: string) => void;
	children: ReactNode;
}

export default function SelectableTracker({
	tracker,
	isSelected,
	onSelect,
	children
}: SelectableTrackerProps) {
	const { isPressing, handlers } = useLongPress({
		onLongPress: () => onSelect(tracker.id),
	});

	return (
		<div className="relative" {...handlers}>
			{/* Tracker content with selection visual feedback */}
			<div
				className={cn(
					"transition-all duration-200 rounded-lg",
					isSelected && "border-2 border-dashed border-primary",
					isPressing && "opacity-80"
				)}
			>
				{children}
			</div>

			{/* Selection checkmark badge */}
			{isSelected && (
				<div className="absolute -top-2 -right-2 h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg z-10">
					<Check className="h-4 w-4" />
				</div>
			)}
		</div>
	);
}
