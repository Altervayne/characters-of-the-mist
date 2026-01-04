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
	PlusCircle
} from 'lucide-react';

// -- Store Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
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
export function useToolbeltActions(context: ToolbeltContext): ToolbeltActions {
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
		downgradeStoryThemeToTag
	} = useCharacterActions();

	const { setCardDialogOpen, setCardToEdit } = useAppGeneralStateStore((state) => state.actions);
	const isEditing = useAppGeneralStateStore((state) => state.isEditing);

	return useMemo(() => {
		const itemActions: ToolbeltAction[] = [];
		const globalActions: ToolbeltAction[] = [];

		// Global actions (always available when editing)
		if (isEditing) {
			globalActions.push({
				id: 'add-card',
				label: t('Toolbelt.addCard') || 'Add Card',
				icon: PlusCircle,
				onClick: () => {
					setCardToEdit(null);
					setCardDialogOpen(true);
				},
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

			// Edit themebook/type action (only for CHARACTER_THEME cards when editing)
			if (card.cardType === 'CHARACTER_THEME' && isEditing) {
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

			// Delete action (only when editing)
			if (isEditing) {
				itemActions.push({
					id: 'delete-card',
					label: t('Toolbelt.delete') || 'Delete',
					icon: Trash2,
					variant: 'destructive',
					onClick: () => deleteCard(card.id),
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

				if (isEditing) {
					itemActions.push({
						id: 'delete-status',
						label: t('Toolbelt.delete') || 'Delete',
						icon: Trash2,
						variant: 'destructive',
						onClick: () => removeStatus(tracker.id),
						show: true
					});
				}
			}

			// Story tag tracker actions
			if (tracker.trackerType === 'STORY_TAG') {
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
				if (isEditing) {
					itemActions.push({
						id: 'upgrade-to-theme',
						label: t('Toolbelt.upgradeToTheme') || 'Upgrade to Theme',
						icon: TrendingUp,
						onClick: () => upgradeStoryTagToTheme(tracker.id),
						show: true
					});
				}

				// Export
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

				// Delete
				if (isEditing) {
					itemActions.push({
						id: 'delete-story-tag',
						label: t('Toolbelt.delete') || 'Delete',
						icon: Trash2,
						variant: 'destructive',
						onClick: () => removeStoryTag(tracker.id),
						show: true
					});
				}
			}

			// Story theme tracker actions
			if (tracker.trackerType === 'STORY_THEME') {
				// Downgrade to tag
				if (isEditing) {
					itemActions.push({
						id: 'downgrade-to-tag',
						label: t('Toolbelt.downgradeToTag') || 'Downgrade to Tag',
						icon: TrendingDown,
						onClick: () => downgradeStoryThemeToTag(tracker.id),
						show: true
					});
				}

				// Export
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

				// Delete
				if (isEditing) {
					itemActions.push({
						id: 'delete-story-theme',
						label: t('Toolbelt.delete') || 'Delete',
						icon: Trash2,
						variant: 'destructive',
						onClick: () => removeStoryTheme(tracker.id),
						show: true
					});
				}
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
		setCardDialogOpen,
		setCardToEdit
	]);
}
