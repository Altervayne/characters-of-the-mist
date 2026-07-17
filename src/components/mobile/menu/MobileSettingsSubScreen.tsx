// -- React Imports --
import type { ReactNode } from 'react';

// -- Icon Imports --
import { ChevronLeft } from 'lucide-react';

// -- Basic UI Imports --
import { IconButton } from '@/components/ui/icon-button';

interface MobileSettingsSubScreenProps {
	/** The screen's heading, shown beside the back button. */
	title: string;
	/** Optional lead-in copy under the heading. */
	description?: string;
	/** Invoked by the back button; when absent the button is hidden. */
	onBack?: () => void;
	/** The screen body, laid out in a padded, bottom-safe scroll column. */
	children: ReactNode;
}

/**
 * The shell for a pushed settings sub-screen: the shared back-header (a ghost chevron + a large title) over a
 * scrolling, safe-area-padded body. Mirrors the header idiom the mobile About/What's-new screens use, so every
 * drill-down reads the same.
 */
export function MobileSettingsSubScreen({ title, description, onBack, children }: MobileSettingsSubScreenProps) {
	return (
		<div className="h-full overflow-y-auto pt-safe">
			<div className="p-6">
				<div className="flex items-center gap-3 mb-4">
					{onBack && (
						<IconButton
							variant="ghost"
							size="lg"
							onClick={onBack}
							className="h-10 w-10 p-0"
						>
							<ChevronLeft className="h-8 w-8" />
						</IconButton>
					)}
					<div className="flex-1">
						<h2 className="text-2xl font-bold">{title}</h2>
					</div>
				</div>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>

			<div className="px-6 pb-[calc(2rem_+_env(safe-area-inset-bottom))] space-y-6">
				{children}
			</div>
		</div>
	);
}
