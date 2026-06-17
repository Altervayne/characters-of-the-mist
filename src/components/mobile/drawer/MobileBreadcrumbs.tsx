// -- React Imports --
import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Home, ChevronRight } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';



interface MobileBreadcrumbsProps {
	/** Root-to-current folder trail; any object with an id and name (e.g. a folder record). */
	breadcrumbPath: Array<{ id: string; name: string }>;
	onNavigate: (folderId: string | null) => void;
}

export default function MobileBreadcrumbs({
	breadcrumbPath,
	onNavigate
}: MobileBreadcrumbsProps) {
	const { t } = useTranslation();
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// The deepest crumb is the current folder (null at root). Used for the Home
	// crumb's active state and as the auto-scroll trigger - equivalent to the
	// currentFolderId this component previously received directly.
	const currentFolderId = breadcrumbPath.length > 0
		? breadcrumbPath[breadcrumbPath.length - 1].id
		: null;

	// Auto-scroll to show current location when it changes
	useEffect(() => {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
		}
	}, [currentFolderId]);

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
