// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { User, Layers, Users, Package, Heart, Tag, Sparkles, FileText, GripVertical, MoreVertical } from 'lucide-react';

// -- Component Imports --
import { DrawerItemPreview } from '@/components/organisms/drawer/DrawerItemPreview';
import { Badge } from '@/components/ui/badge';

// -- DnD Component Imports --
import { Sortable, DragStaticWrapper } from '@/components/dnd';

// -- Hook Imports --
import { useLongPress } from '@/hooks/mobile/useLongPress';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';



interface MobileDrawerItemProps {
	item: DrawerItem;
	isCompact: boolean;
	onLongPress: (itemId: string, itemName: string, position: { x: number; y: number }) => void;
	isLeftHanded: boolean;
}

// Icon mapping for different item types
const getItemIcon = (type: GeneralItemType) => {
	switch (type) {
		case 'CHARACTER_CARD':
			return User;
		case 'CHARACTER_THEME':
			return Layers;
		case 'GROUP_THEME':
			return Users;
		case 'LOADOUT_THEME':
			return Package;
		case 'STATUS_TRACKER':
			return Heart;
		case 'STORY_TAG_TRACKER':
			return Tag;
		case 'STORY_THEME_TRACKER':
			return Sparkles;
		case 'FULL_CHARACTER_SHEET':
			return FileText;
		default:
			return FileText;
	}
};

// Game badge color mapping
const getGameBadgeVariant = (game: string) => {
	switch (game) {
		case 'LEGENDS':
			return 'default';
		case 'CITY_OF_MIST':
			return 'secondary';
		case 'OTHERSCAPE':
			return 'outline';
		default:
			return 'default';
	}
};

// Get display name for game system
const getGameDisplayName = (game: string) => {
	switch (game) {
		case 'LEGENDS':
			return 'Legend';
		case 'CITY_OF_MIST':
			return 'City';
		case 'OTHERSCAPE':
			return 'Otherscape';
		default:
			return game;
	}
};

/**
 * A drawer item row on mobile: a drag handle plus a long-pressable body, shown
 * either compact (icon + name + game badge) or rich (full preview).
 *
 * The body keeps its {@link useLongPress} context-menu gesture, while the
 * dedicated ≥44px grip handle owns drag-to-reorder. Handle and body are siblings
 * (the long-press handlers are spread only on the body), so the @dnd-kit
 * `TouchSensor` and the long-press timer never share an element: dragging from
 * the handle never opens the menu, and a long-press on the body never starts a
 * drag. The handle sits on the handedness-leading edge and is touch-action: none
 * so an intentional drag is not pre-empted by the list's vertical scroll.
 *
 * A trailing overflow (⋮) button is the always-present button fallback for the
 * long-press context menu (it opens the same menu, anchored at the button).
 *
 * @param item - The drawer item to render.
 * @param isCompact - Render the compact row when true, the rich preview otherwise.
 * @param onLongPress - Called with the item id, name, and a screen position to anchor the context menu (long-press or overflow button).
 * @param isLeftHanded - Mirrors the grip handle to the left edge when true.
 */
export default function MobileDrawerItem({
	item,
	isCompact,
	onLongPress,
	isLeftHanded,
}: MobileDrawerItemProps) {
	const { t } = useTranslation();
	const areGestureHintsEnabled = useAppSettingsStore((state) => state.areGestureHintsEnabled);
	const { isPressing, handlers } = useLongPress({
		onLongPress: (position) => onLongPress(item.id, item.name, position),
	});

	const Icon = getItemIcon(item.type);

	return (
		<Sortable id={item.id} data={{ type: DRAG_TYPES.DRAWER_ITEM, item }}>
			{({ dragAttributes, dragListeners, isBeingDragged }) => (
				<DragStaticWrapper isBeingDragged={isBeingDragged}>
					<div
						className={cn(
							"flex items-center rounded-lg border border-border bg-card overflow-hidden",
							isLeftHanded && "flex-row-reverse"
						)}
					>
						{/* Drag handle (≥44px touch target) */}
						<button
							type="button"
							aria-label={t('Common.dragHandle')}
							className={cn(
								"flex shrink-0 items-center justify-center h-11 w-11 text-muted-foreground touch-none cursor-grab active:cursor-grabbing",
								// Drag affordance cue, gated on the gesture-tips setting.
								areGestureHintsEnabled && "bg-muted/50 rounded-md"
							)}
							{...dragAttributes}
							{...dragListeners}
						>
							<GripVertical className="w-5 h-5" />
						</button>

						{/* Body: long-press opens the context menu */}
						{isCompact ? (
							<div
								{...handlers}
								className={cn(
									"flex flex-1 min-w-0 items-center gap-3 p-3 transition-all",
									"active:scale-[0.98] cursor-pointer",
									isPressing && "bg-muted scale-[0.98]"
								)}
								style={{ minHeight: '60px' }} // Ensure adequate touch target
							>
								<div className="shrink-0">
									<Icon className="w-5 h-5 text-muted-foreground" />
								</div>

								<div className="flex-1 min-w-0">
									<p className="font-medium text-foreground truncate">
										{item.name}
									</p>
									<div className="flex items-center gap-2 mt-1">
										<Badge variant={getGameBadgeVariant(item.game)} className="text-xs">
											{getGameDisplayName(item.game)}
										</Badge>
									</div>
								</div>
							</div>
						) : (
							<div
								{...handlers}
								className={cn(
									"flex-1 min-w-0 transition-all",
									"active:scale-[0.98] cursor-pointer",
									isPressing && "ring-2 ring-primary scale-[0.98]"
								)}
							>
								<DrawerItemPreview item={item} />
							</div>
						)}

						{/* Overflow button: always-present fallback for the long-press menu */}
						<button
							type="button"
							aria-label={t('Common.moreOptions', { defaultValue: 'More options' })}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								onLongPress(item.id, item.name, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
							}}
							className="flex shrink-0 items-center justify-center h-11 w-11 text-muted-foreground"
						>
							<MoreVertical className="w-5 h-5" />
						</button>
					</div>
				</DragStaticWrapper>
			)}
		</Sortable>
	);
}
