// -- Icon Imports --
import { Folder } from 'lucide-react';

// -- Component Imports --
import { FolderCountLabel } from '@/components/mobile/shared/FolderCountLabel';

// -- Hook Imports --
import { useLongPress } from '@/hooks/mobile/useLongPress';

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
	const { isPressing, handlers } = useLongPress({
		onLongPress: (position) => onLongPress(folder.id, folder.name, position),
		onTap: () => onNavigate(folder.id),
	});

	// Calculate total items in folder (including nested)
	const totalItems = folder.items.length;
	const totalSubfolders = folder.folders.length;

	return (
		<div
			{...handlers}
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
				<FolderCountLabel folders={totalSubfolders} items={totalItems} />
			</div>
		</div>
	);
}
