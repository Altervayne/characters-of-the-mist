// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { StatusTrackerCard } from '@/components/molecules/status-tracker';
import { StoryTagTrackerCard } from '@/components/molecules/story-tag-tracker';
import { StoryThemeTrackerCard } from '@/components/organisms/story-theme-tracker';
import { Button } from '@/components/ui/button';
import MobileCardCarousel from './MobileCardCarousel';

// -- Store Imports --
import { useCharacterStore, useCharacterActions } from '@/lib/stores/characterStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Utils Imports --
import { cn } from '@/lib/utils';

type SheetTab = 'trackers' | 'cards';

export default function MobileCharacterSheet() {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<SheetTab>('trackers');

	// Character data
	const character = useCharacterStore((state) => state.character);
	const { updateCharacterName, addStatus, addStoryTag } = useCharacterActions();

	// Settings
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);
	const isTrackersAlwaysEditable = useAppSettingsStore((state) => state.isTrackersAlwaysEditable);
	const areTrackersEditable = isEditing || isTrackersAlwaysEditable;

	// Character name input with debouncing
	const [localName, setLocalName] = useInputDebouncer(
		character?.name || '',
		500,
		(debouncedValue) => {
			if (character && debouncedValue !== character.name) {
				updateCharacterName(debouncedValue);
			}
		}
	);

	// If no character loaded, show empty state
	if (!character) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center">
				<h2 className="text-xl font-bold mb-4">
					{t('MobileCharacterSheet.noCharacter') || 'No Character Loaded'}
				</h2>
				<p className="text-muted-foreground mb-6">
					{t('MobileCharacterSheet.loadCharacterPrompt') || 'Load a character from the drawer or create a new one to get started.'}
				</p>
				<p className="text-sm text-muted-foreground">
					{t('MobileCharacterSheet.drawerHint') || 'Tap the Drawer tab below to browse your saved characters.'}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Character Name Header */}
			<header className="p-4 bg-popover border-b border-border">
				<input
					type="text"
					value={localName}
					onChange={(e) => setLocalName(e.target.value)}
					className={cn(
						"w-full text-2xl font-bold bg-transparent outline-none transition-colors",
						"placeholder:text-muted-foreground/50",
						"focus:text-primary"
					)}
					placeholder={t('CharacterSheetPage.characterNamePlaceholder') || 'Character Name'}
				/>
			</header>

			{/* Tab Navigation */}
			<div className="flex border-b border-border bg-card">
				<button
					onClick={() => setActiveTab('trackers')}
					className={cn(
						"flex-1 px-4 py-3 text-sm font-medium transition-colors",
						"border-b-2",
						activeTab === 'trackers'
							? "border-primary text-primary bg-primary/5"
							: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
					)}
				>
					{t('MobileCharacterSheet.trackersTab') || 'Trackers'}
				</button>
				<button
					onClick={() => setActiveTab('cards')}
					className={cn(
						"flex-1 px-4 py-3 text-sm font-medium transition-colors",
						"border-b-2",
						activeTab === 'cards'
							? "border-primary text-primary bg-primary/5"
							: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
					)}
				>
					{t('MobileCharacterSheet.cardsTab') || 'Cards'}
					{character.cards.length > 0 && (
						<span className="ml-2 text-xs text-muted-foreground">
							({character.cards.length})
						</span>
					)}
				</button>
			</div>

			{/* Tab Content */}
			<div className="flex-1 overflow-hidden pb-20">
				{activeTab === 'trackers' && (
					<div className="h-full overflow-y-auto p-4 space-y-6">
						{/* Statuses Section */}
						<section>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{t('MobileCharacterSheet.statuses') || 'Statuses'}
							</h3>
							<div className="space-y-3">
								{character.trackers.statuses.map((tracker) => (
									<StatusTrackerCard
										key={tracker.id}
										tracker={tracker}
										isEditing={areTrackersEditable}
										onExport={() => {}}
									/>
								))}
								{areTrackersEditable && (
									<Button
										variant="ghost"
										onClick={() => addStatus()}
										className={cn(
											"w-full h-16 border-2 border-dashed border-primary/25",
											"text-muted-foreground bg-primary/5",
											"hover:text-foreground hover:border-foreground"
										)}
									>
										+ {t('Trackers.addStatus') || 'Add Status'}
									</Button>
								)}
							</div>
						</section>

						{/* Story Tags Section */}
						<section>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{t('MobileCharacterSheet.storyTags') || 'Story Tags'}
							</h3>
							<div className="space-y-3">
								{character.trackers.storyTags.map((tracker) => (
									<StoryTagTrackerCard
										key={tracker.id}
										tracker={tracker}
										isEditing={areTrackersEditable}
										onExport={() => {}}
									/>
								))}
								{areTrackersEditable && (
									<Button
										variant="ghost"
										onClick={() => addStoryTag()}
										className={cn(
											"w-full h-16 border-2 border-dashed border-primary/25",
											"text-muted-foreground bg-primary/5",
											"hover:text-foreground hover:border-foreground"
										)}
									>
										+ {t('Trackers.addStoryTag') || 'Add Story Tag'}
									</Button>
								)}
							</div>
						</section>

						{/* Story Themes Section */}
						<section>
							<h3 className="text-sm font-semibold text-muted-foreground mb-3">
								{t('MobileCharacterSheet.storyThemes') || 'Story Themes'}
							</h3>
							<div className="space-y-3">
								{character.trackers.storyThemes.map((tracker) => (
									<StoryThemeTrackerCard
										key={tracker.id}
										tracker={tracker}
										isEditing={isEditing}
										onExport={() => {}}
									/>
								))}
							</div>
						</section>
					</div>
				)}

				{activeTab === 'cards' && (
					<MobileCardCarousel cards={character.cards} />
				)}
			</div>
		</div>
	);
}
