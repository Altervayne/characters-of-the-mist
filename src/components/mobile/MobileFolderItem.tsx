// Mobile Folder Item Component
// Displays a folder with tap to navigate and long-press for context menu

// -- React Imports --
import { useState, useRef } from 'react';

// -- Icon Imports --
import { Folder } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Folder as FolderType } from '@/lib/types/drawer';



interface MobileFolderItemProps {
	folder: FolderType;
	onNavigate: (folderId: string) => void;
	onLongPress: (folderId: string, folderName: string, position: { x: number; y: number }) => void;
}

export default function MobileFolderItem({
	folder,
	onNavigate,
	onLongPress
}: MobileFolderItemProps) {
	const [isPressing, setIsPressing] = useState(false);
	const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const touchStartPos = useRef<{ x: number; y: number } | null>(null);

	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0];
		touchStartPos.current = { x: touch.clientX, y: touch.clientY };
		setIsPressing(true);

		longPressTimer.current = setTimeout(() => {
			if (touchStartPos.current) {
				onLongPress(folder.id, folder.name, touchStartPos.current);
			}
			setIsPressing(false);
		}, 500); // 500ms for long press
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (!touchStartPos.current) return;

		const touch = e.touches[0];
		const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
		const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

		// Cancel long-press if user moves finger too much
		if (deltaX > 10 || deltaY > 10) {
			if (longPressTimer.current) {
				clearTimeout(longPressTimer.current);
			}
			setIsPressing(false);
		}
	};

	const handleTouchEnd = () => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
		}

		// If still pressing (not long-press), it's a tap
		if (isPressing) {
			onNavigate(folder.id);
		}

		setIsPressing(false);
		touchStartPos.current = null;
	};

	const handleTouchCancel = () => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
		}
		setIsPressing(false);
		touchStartPos.current = null;
	};

	// Calculate total items in folder (including nested)
	const totalItems = folder.items.length;
	const totalSubfolders = folder.folders.length;

	return (
		<div
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onTouchCancel={handleTouchCancel}
			className={cn(
				"flex items-center gap-3 p-3 rounded-lg border border-border bg-card transition-all",
				"active:scale-[0.98] cursor-pointer",
				isPressing && "bg-muted scale-[0.98]"
			)}
			style={{ minHeight: '60px' }} // Ensure adequate touch target
		>
			<div className="shrink-0">
				<Folder className="w-6 h-6 text-primary" />
			</div>

			<div className="flex-1 min-w-0">
				<p className="font-medium text-foreground truncate">
					{folder.name}
				</p>
				<p className="text-xs text-muted-foreground">
					{totalSubfolders > 0 && `${totalSubfolders} folder${totalSubfolders !== 1 ? 's' : ''}`}
					{totalSubfolders > 0 && totalItems > 0 && ', '}
					{totalItems > 0 && `${totalItems} item${totalItems !== 1 ? 's' : ''}`}
					{totalSubfolders === 0 && totalItems === 0 && 'Empty'}
				</p>
			</div>
		</div>
	);
}
