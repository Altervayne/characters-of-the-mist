// -- React Imports --
import type { TouchEvent } from 'react';

// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { Button } from '@/components/ui/button';
import SelectableTracker from '@/components/mobile/character-sheet/SelectableTracker';

// -- Icon Imports --
import { PlusCircle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Character } from '@/lib/types/character';



interface MobileTrackersSectionProps {
	character: Character;
	areTrackersEditable: boolean;
	isEditing: boolean;
	isMobileFABMode: boolean;
	selectedTrackerId: string | null;
	onSelectTracker: (id: string) => void;
	onAddStatus: () => void;
	onAddStoryTag: () => void;
	onAddStoryTheme: () => void;
	touchHandlers: { onTouchStart: (event: TouchEvent) => void; onTouchEnd: (event: TouchEvent) => void };
}

/**
 * The trackers tab of the mobile character sheet: the statuses, story-tag, and
 * story-theme groups, each rendering its trackers wrapped in a tap-to-select
 * `SelectableTracker` and (when editable) an add button. Purely presentational -
 * the character, edit flags, selection, add handlers, and the trackers-area swipe
 * handlers (spread onto the scroll container) all come from the sheet. The
 * trackers-area touch handlers and `data-tutorial` anchor are preserved.
 *
 * Note: the story-themes group intentionally gates its card on `isEditing` rather
 * than `areTrackersEditable` (unlike the other two groups) - preserved verbatim
 * from the original; not a normalization target.
 */
export function MobileTrackersSection({ character, areTrackersEditable, isEditing, isMobileFABMode, selectedTrackerId, onSelectTracker, onAddStatus, onAddStoryTag, onAddStoryTheme, touchHandlers }: MobileTrackersSectionProps) {
	const { t } = useTranslation();

	return (
		<div
			className={cn("h-full overflow-y-auto p-4", isMobileFABMode && "pb-32")}
			data-tutorial="trackers-section"
			{...touchHandlers}
		>
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Statuses Section */}
				{(character.trackers.statuses.length > 0 || areTrackersEditable) && (
				<section>
					<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
						{t('MobileCharacterSheet.statuses')}
					</h3>
					<div className="flex flex-wrap justify-center gap-3">
						{character.trackers.statuses.map((tracker) => (
							<SelectableTracker
								key={tracker.id}
								tracker={tracker}
								isSelected={selectedTrackerId === tracker.id}
								onSelect={onSelectTracker}
							>
								<StatusTrackerCard
									tracker={tracker}
									isEditing={areTrackersEditable}
									onExport={() => {}}
								/>
							</SelectableTracker>
						))}
						{areTrackersEditable && (
							<Button
								variant="ghost"
								onClick={onAddStatus}
								className={cn(
									"w-55 h-25 border-2 border-dashed border-primary/25",
									"text-muted-foreground bg-primary/5",
									"hover:text-foreground hover:border-foreground",
									"flex items-center justify-center gap-2"
								)}
							>
								<PlusCircle className="mr-2 h-4 w-4" />
								{t('Trackers.addStatus')}
							</Button>
						)}
					</div>
				</section>
				)}

				{/* Story Tags Section */}
				{(character.trackers.storyTags.length > 0 || areTrackersEditable) && (
				<section>
					<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
						{t('MobileCharacterSheet.storyTags')}
					</h3>
					<div className="flex flex-wrap justify-center gap-3">
						{character.trackers.storyTags.map((tracker) => (
							<SelectableTracker
								key={tracker.id}
								tracker={tracker}
								isSelected={selectedTrackerId === tracker.id}
								onSelect={onSelectTracker}
							>
								<StoryTagTrackerCard
									tracker={tracker}
									isEditing={areTrackersEditable}
									onExport={() => {}}
								/>
							</SelectableTracker>
						))}
						{areTrackersEditable && (
							<Button
								variant="ghost"
								onClick={onAddStoryTag}
								className={cn(
									"w-55 min-h-13.75 py-2 border-2 border-dashed border-primary/25",
									"text-muted-foreground bg-primary/5",
									"hover:text-foreground hover:border-foreground",
									"flex items-center justify-center gap-2"
								)}
							>
								<PlusCircle className="mr-2 h-4 w-4" />
								{t('Trackers.addStoryTag')}
							</Button>
						)}
					</div>
				</section>
				)}

				{/* Story Themes Section */}
				{(character.trackers.storyThemes.length > 0 || areTrackersEditable) && (
				<section>
					<h3 className="text-sm font-semibold text-muted-foreground mb-3 text-center">
						{t('MobileCharacterSheet.storyThemes')}
					</h3>
					<div className="flex flex-wrap justify-center gap-3">
						{character.trackers.storyThemes.map((tracker) => (
							<SelectableTracker
								key={tracker.id}
								tracker={tracker}
								isSelected={selectedTrackerId === tracker.id}
								onSelect={onSelectTracker}
							>
								<StoryThemeTrackerCard
									tracker={tracker}
									isEditing={isEditing}
									onExport={() => {}}
								/>
							</SelectableTracker>
						))}
						{areTrackersEditable && (
							<Button
								variant="ghost"
								onClick={onAddStoryTheme}
								className={cn(
									"w-62.5 h-55 border-2 border-dashed border-primary/25",
									"text-muted-foreground bg-primary/5",
									"hover:text-foreground hover:border-foreground",
									"flex items-center justify-center gap-2"
								)}
							>
								<PlusCircle className="mr-2 h-4 w-4" />
								{t('Trackers.addStoryTheme')}
							</Button>
						)}
					</div>
				</section>
				)}
			</div>
		</div>
	);
}
