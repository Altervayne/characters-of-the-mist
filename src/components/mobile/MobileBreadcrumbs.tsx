// Mobile Breadcrumbs Component
// Horizontal scrolling breadcrumb trail for folder navigation

// -- React Imports --
import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Home, ChevronRight } from 'lucide-react';

// -- Utils Imports --
import { buildBreadcrumb } from '@/lib/utils/drawer';
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Folder } from '@/lib/types/drawer';



interface MobileBreadcrumbsProps {
	folders: Folder[];
	currentFolderId: string | null;
	onNavigate: (folderId: string | null) => void;
}

export default function MobileBreadcrumbs({
	folders,
	currentFolderId,
	onNavigate
}: MobileBreadcrumbsProps) {
	const { t } = useTranslation();
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to show current location when it changes
	useEffect(() => {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
		}
	}, [currentFolderId]);

	// Build breadcrumb path
	const breadcrumbPath = currentFolderId
		? buildBreadcrumb(folders, currentFolderId)
		: [];

	return (
		<div
			ref={scrollContainerRef}
			className="flex items-center gap-1 overflow-x-auto overflow-y-hidden py-2 px-4 bg-card border-b border-border scrollbar-hide"
			style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
		>
			{/* Home/Root crumb */}
			<button
				onClick={() => onNavigate(null)}
				className={cn(
					"flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0",
					currentFolderId === null
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground hover:bg-muted"
				)}
			>
				<Home className="w-4 h-4" />
				<span>{t('Drawer.root')}</span>
			</button>

			{/* Folder path crumbs */}
			{breadcrumbPath.map((folder, index) => {
				const isLast = index === breadcrumbPath.length - 1;

				return (
					<div key={folder.id} className="flex items-center gap-1 shrink-0">
						<ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
						<button
							onClick={() => onNavigate(folder.id)}
							className={cn(
								"px-2 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
								isLast
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:text-foreground hover:bg-muted"
							)}
						>
							{folder.name}
						</button>
					</div>
				);
			})}
		</div>
	);
}
