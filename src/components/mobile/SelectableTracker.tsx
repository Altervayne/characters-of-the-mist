// -- React Imports --
import { useState, useRef, type ReactNode } from 'react';

// -- Icon Imports --
import { Check } from 'lucide-react';

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

const LONG_PRESS_DURATION = 500; // ms

export default function SelectableTracker({
	tracker,
	isSelected,
	onSelect,
	children
}: SelectableTrackerProps) {
	const [isPressing, setIsPressing] = useState(false);
	const longPressTimer = useRef<NodeJS.Timeout | null>(null);
	const touchStartPos = useRef<{ x: number; y: number } | null>(null);

	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		touchStartPos.current = { x: touch.clientX, y: touch.clientY };
		setIsPressing(true);

		// Start long-press timer
		longPressTimer.current = setTimeout(() => {
			// Trigger haptic feedback if available
			if ('vibrate' in navigator) {
				navigator.vibrate(50);
			}

			// Toggle selection
			onSelect(tracker.id);
			setIsPressing(false);
		}, LONG_PRESS_DURATION);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		// If finger moves too far, cancel the long-press
		if (touchStartPos.current && longPressTimer.current) {
			const touch = e.touches[0];
			const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
			const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

			// Cancel if moved more than 10px
			if (deltaX > 10 || deltaY > 10) {
				clearTimeout(longPressTimer.current);
				longPressTimer.current = null;
				setIsPressing(false);
			}
		}
	};

	const handleTouchEnd = () => {
		// Cancel long-press if touch ends before timer completes
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
		setIsPressing(false);
		touchStartPos.current = null;
	};

	const handleTouchCancel = () => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
		setIsPressing(false);
		touchStartPos.current = null;
	};

	return (
		<div
			className="relative"
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onTouchCancel={handleTouchCancel}
		>
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
