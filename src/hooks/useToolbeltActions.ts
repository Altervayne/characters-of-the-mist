// -- React Imports --
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import {
	Trash2,
	Download,
	FlipVertical,
	TrendingUp,
	TrendingDown,
	ThumbsUp,
	ThumbsDown,
	SplitSquareVertical,
	Edit3,
	PlusCircle,
	Undo2,
	Redo2,
	Heart,
	Tag,
	Sparkles,
	Edit as EditIcon,
	ArrowUpDown
} from 'lucide-react';

// -- Store Imports --
import { useCharacterActions, useCharacterStore } from '@/lib/stores/characterStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// -- Utils Imports --
import { exportToFile } from '@/lib/utils/export-import';

// -- Type Imports --
import type { ToolbeltActions, ToolbeltAction, ToolbeltContext } from '@/lib/types/toolbelt';
import type { Card, CardViewMode } from '@/lib/types/character';

/**
 * Hook to build action lists for the Toolbelt based on the current context.
 * Returns both item-specific actions and global actions (like Add Card).
 */
export function useToolbeltActions(context: ToolbeltContext, activeTab?: 'trackers' | 'cards', onEnterCardReorderMode?: () => void, onOpenAddCard?: () => void): ToolbeltActions {
	const { t } = useTranslation();
	const {
		flipCard,
		deleteCard,
		updateCardViewMode,
		removeStatus,
		removeStoryTag,
		removeStoryTheme,
		updateStoryTag,
		upgradeStoryTagToTheme,
		downgradeStoryThemeToTag,
		addStatus,
		addStoryTag,
      addStoryTheme
	} = useCharacterActions();

	const { toggleIsEditing, setCardDialogOpen } = useAppGeneralStateStore((state) => state.actions);
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);

	// Desktop manages cardToEdit locally in CharacterSheetPage, not in the store
	// This is a no-op placeholder for desktop compatibility
	const setCardToEdit = (_card: Card | null) => {
		// Desktop CharacterSheetPage handles this locally
		// Mobile uses onOpenAddCard callback instead
	};

	return useMemo(() => {
		const itemActions: ToolbeltAction[] = [];
		const globalActions: ToolbeltAction[] = [];

		// Get undo/redo state
		const { undo, redo, pastStates, futureStates } = useCharacterStore.temporal.getState();
		const canUndo = (pastStates?.length ?? 0) > 1;
		const canRedo = (futureStates?.length ?? 0) > 0;

		// --- Undo/Redo (always visible, grayed when disabled) ---
		globalActions.push({
			id: 'undo',
			label: t('Toolbelt.undo') || 'Undo',
			icon: Undo2,
			onClick: () => canUndo && undo(),
			show: true
		});

		globalActions.push({
			id: 'redo',
			label: t('Toolbelt.redo') || 'Redo',
			icon: Redo2,
			onClick: () => canRedo && redo(),
			show: true
		});

		// --- Edit Mode Toggle (in FAB mode) ---
		globalActions.push({
			id: 'toggle-edit-mode',
			label: isEditing ? (t('Toolbelt.playMode') || 'Play Mode') : (t('Toolbelt.editMode') || 'Edit Mode'),
			icon: EditIcon,
			onClick: () => toggleIsEditing(),
			show: true
		});

		// --- Context-aware Add buttons ---
		// Add Card (only on cards tab)
		if (activeTab === 'cards') {
			// Reorder Cards action
			if (onEnterCardReorderMode) {
				globalActions.push({
					id: 'reorder-cards',
					label: t('Toolbelt.reorderCards') || 'Reorder Cards',
					icon: ArrowUpDown,
					onClick: onEnterCardReorderMode,
					show: true
				});
			}

			globalActions.push({
				id: 'add-card',
				label: t('Toolbelt.addCard') || 'Add Card',
				icon: PlusCircle,
				onClick: () => {
					if (onOpenAddCard) {
						onOpenAddCard();
					} else {
						setCardToEdit(null);
						setCardDialogOpen(true);
					}
				},
				show: true
			});
		}

		// Add trackers (only on trackers tab)
		if (activeTab === 'trackers') {
			globalActions.push({
				id: 'add-status',
				label: t('Toolbelt.addStatus') || 'Add Status',
				icon: Heart,
				onClick: () => addStatus(),
				show: true
			});

			globalActions.push({
				id: 'add-story-tag',
				label: t('Toolbelt.addStoryTag') || 'Add Story Tag',
				icon: Tag,
				onClick: () => addStoryTag(),
				show: true
			});

			globalActions.push({
				id: 'add-story-theme',
				label: t('Toolbelt.addStoryTheme') || 'Add Story Theme',
				icon: Sparkles,
				onClick: () => addStoryTheme(),
				show: true
			});
		}

		// No context - return only global actions
		if (context.type === 'none') {
			return {
				itemActions: [],
				globalActions: globalActions.filter(a => a.show)
			};
		}

		// Card actions
		if (context.type === 'card') {
			const card = context.card;

			// --- Delete, Flip/ViewMode/Export, Edit ---

			// Delete action - NOT allowed for CHARACTER_CARD
			if (card.cardType !== 'CHARACTER_CARD') {
				itemActions.push({
					id: 'delete-card',
					label: t('Toolbelt.delete') || 'Delete',
					icon: Trash2,
					variant: 'destructive',
					onClick: () => deleteCard(card.id),
					show: true
				});
			}

			// Flip card action
			itemActions.push({
				id: 'flip-card',
				label: t('Toolbelt.flipCard') || 'Flip Card',
				icon: FlipVertical,
				onClick: () => flipCard(card.id),
				show: true
			});

			// View mode toggle action
			const currentViewMode = card.viewMode;
			const nextViewMode: CardViewMode = currentViewMode === 'FLIP' ? 'SIDE_BY_SIDE' : 'FLIP';
			const viewModeLabel = nextViewMode === 'SIDE_BY_SIDE'
				? (t('Toolbelt.sideBySideMode') || 'Side by Side')
				: (t('Toolbelt.flipMode') || 'Flip Mode');

			itemActions.push({
				id: 'toggle-view-mode',
				label: viewModeLabel,
				icon: SplitSquareVertical,
				onClick: () => updateCardViewMode(card.id, nextViewMode),
				show: true
			});

			// Export action
			itemActions.push({
				id: 'export-card',
				label: t('Toolbelt.export') || 'Export',
				icon: Download,
				onClick: () => {
					exportToFile(
						card,
						card.cardType,
						card.details.game,
						`${card.cardType}-${card.id}.cotm`
					);
				},
				show: true
			});

			// Edit themebook/type action
			if (card.cardType === 'CHARACTER_THEME') {
				itemActions.push({
					id: 'edit-themebook',
					label: t('Toolbelt.editThemebook') || 'Edit Theme',
					icon: Edit3,
					onClick: () => {
						setCardToEdit(card);
						setCardDialogOpen(true);
					},
					show: true
				});
			}

			return {
				itemActions: itemActions.filter(a => a.show),
				globalActions: globalActions.filter(a => a.show)
			};
		}

		// Tracker actions
		if (context.type === 'tracker') {
			const tracker = context.tracker;

			// Status tracker actions
			if (tracker.trackerType === 'STATUS') {
				// Delete first
				itemActions.push({
					id: 'delete-status',
					label: t('Toolbelt.delete') || 'Delete',
					icon: Trash2,
					variant: 'destructive',
					onClick: () => removeStatus(tracker.id),
					show: true
				});

				// Export last
				itemActions.push({
					id: 'export-status',
					label: t('Toolbelt.export') || 'Export',
					icon: Download,
					onClick: () => {
						exportToFile(
							tracker,
							'STATUS_TRACKER',
							tracker.game,
							`status-${tracker.id}.cotm`
						);
					},
					show: true
				});
			}

			// Story tag tracker actions
			if (tracker.trackerType === 'STORY_TAG') {
				// Delete first
				itemActions.push({
					id: 'delete-story-tag',
					label: t('Toolbelt.delete') || 'Delete',
					icon: Trash2,
					variant: 'destructive',
					onClick: () => removeStoryTag(tracker.id),
					show: true
				});

				// Toggle positive/negative
				const isWeakness = tracker.isWeakness ?? false;
				itemActions.push({
					id: 'toggle-story-tag-type',
					label: isWeakness
						? (t('Toolbelt.makePositive') || 'Make Positive')
						: (t('Toolbelt.makeNegative') || 'Make Negative'),
					icon: isWeakness ? ThumbsUp : ThumbsDown,
					onClick: () => updateStoryTag(tracker.id, { isWeakness: !isWeakness }),
					show: true
				});

				// Upgrade to theme
				itemActions.push({
					id: 'upgrade-to-theme',
					label: t('Toolbelt.upgradeToTheme') || 'Upgrade to Theme',
					icon: TrendingUp,
					onClick: () => upgradeStoryTagToTheme(tracker.id),
					show: true
				});

				// Export last
				itemActions.push({
					id: 'export-story-tag',
					label: t('Toolbelt.export') || 'Export',
					icon: Download,
					onClick: () => {
						exportToFile(
							tracker,
							'STORY_TAG_TRACKER',
							tracker.game,
							`story-tag-${tracker.id}.cotm`
						);
					},
					show: true
				});
			}

			// Story theme tracker actions
			if (tracker.trackerType === 'STORY_THEME') {
				// Delete first
				itemActions.push({
					id: 'delete-story-theme',
					label: t('Toolbelt.delete') || 'Delete',
					icon: Trash2,
					variant: 'destructive',
					onClick: () => removeStoryTheme(tracker.id),
					show: true
				});

				// Downgrade to tag
				itemActions.push({
					id: 'downgrade-to-tag',
					label: t('Toolbelt.downgradeToTag') || 'Downgrade to Tag',
					icon: TrendingDown,
					onClick: () => downgradeStoryThemeToTag(tracker.id),
					show: true
				});

				// Export last
				itemActions.push({
					id: 'export-story-theme',
					label: t('Toolbelt.export') || 'Export',
					icon: Download,
					onClick: () => {
						exportToFile(
							tracker,
							'STORY_THEME_TRACKER',
							tracker.game,
							`story-theme-${tracker.id}.cotm`
						);
					},
					show: true
				});
			}

			return {
				itemActions: itemActions.filter(a => a.show),
				globalActions: globalActions.filter(a => a.show)
			};
		}

		return {
			itemActions: [],
			globalActions: globalActions.filter(a => a.show)
		};
	}, [
		context,
		activeTab,
		t,
		isEditing,
		flipCard,
		deleteCard,
		updateCardViewMode,
		removeStatus,
		removeStoryTag,
		removeStoryTheme,
		updateStoryTag,
		upgradeStoryTagToTheme,
		downgradeStoryThemeToTag,
		addStatus,
		addStoryTag,
      addStoryTheme,
		setCardDialogOpen,
		setCardToEdit,
		toggleIsEditing,
		onEnterCardReorderMode,
		onOpenAddCard
	]);
}
