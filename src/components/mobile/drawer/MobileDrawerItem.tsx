// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { User, Layers, Users, Package, Heart, Tag, Sparkles, FileText, MoreHorizontal } from 'lucide-react';

// -- Component Imports --
import { DrawerItemPreview } from '@/components/organisms/drawer/DrawerItemPreview';
import { Badge } from '@/components/ui/badge';

// -- DnD Component Imports --
import { Sortable, DragStaticWrapper } from '@/components/dnd';

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
 * A drawer item row on mobile: a long-press-to-drag body and an inline
 * context-menu button on the handedness-leading edge.
 *
 * The whole row body is the drag target - dnd-kit's `TouchSensor` is configured
 * with the drawer's longer ~500ms delay (see `useMobileDragSensors`), so a
 * deliberate press-and-hold picks the row up while a quick tap or a scroll
 * fling falls through to the normal touch behaviour. There is no dedicated
 * grip handle, reclaiming the horizontal space it used to occupy and letting
 * names use the row's full width (wrapping over multiple lines if needed).
 *
 * The `⋯` context-menu button placement differs by view. Compact view keeps it
 * as a real flex sibling beside the name, inside the same card. Rich view passes
 * it into the preview card's own title row (via `DrawerItemPreview`'s
 * `headerAction`) so it reads as that card's corner action instead of floating
 * in a separate column beside it. Either way its side flips with handedness:
 * right for right-handed (default), left when left-handed. Touch events on the
 * button are stopped from propagating so a tap on it never also begins a drag on
 * the body.
 *
 * @param item - The drawer item to render.
 * @param isCompact - Render the compact row when true, the rich preview otherwise.
 * @param onLongPress - Called with the item id, name, and a screen position to anchor the context menu (from the corner button).
 * @param isLeftHanded - Places the menu button on the handedness-leading edge: right for right-handed (default), left when true.
 */
export default function MobileDrawerItem({
	item,
	isCompact,
	onLongPress,
	isLeftHanded,
}: MobileDrawerItemProps) {
	const { t } = useTranslation();

	const Icon = getItemIcon(item.type);

	// Shared context-menu button used by both layouts. Stops touch events from
	// bubbling so a tap on the button never also begins a drag on the body.
	const menuButton = (
		<button
			type="button"
			aria-label={t('Common.moreOptions')}
			onClick={(event) => {
				event.stopPropagation();
				const rect = event.currentTarget.getBoundingClientRect();
				onLongPress(item.id, item.name, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
			}}
			onTouchStart={(event) => event.stopPropagation()}
			onTouchEnd={(event) => event.stopPropagation()}
			className="flex shrink-0 items-center justify-center h-11 w-11 text-muted-foreground"
		>
			<MoreHorizontal className="w-5 h-5" />
		</button>
	);

	return (
		<Sortable id={item.id} data={{ type: DRAG_TYPES.DRAWER_ITEM, item }}>
			{({ dragAttributes, dragListeners, isBeingDragged }) => (
				<DragStaticWrapper isBeingDragged={isBeingDragged}>
					{isCompact ? (
						// Compact: a thin card whose body (icon + name + badge) is the
						// drag target, with the menu button as a real flex sibling on
						// the handedness-leading edge.
						<div
							className={cn(
								"flex items-center rounded-lg border border-border bg-card overflow-hidden",
								isLeftHanded && "flex-row-reverse"
							)}
						>
							<div
								{...dragAttributes}
								{...dragListeners}
								className="flex flex-1 min-w-0 cursor-grab active:cursor-grabbing select-none"
							>
								<div className="flex flex-1 min-w-0 items-center gap-2 p-2 min-h-11">
									<div className="shrink-0">
										<Icon className="w-5 h-5 text-muted-foreground" />
									</div>

									<div className="flex-1 min-w-0">
										<p className="font-medium text-foreground break-words">
											{item.name}
										</p>
										<div className="flex items-center gap-2 mt-1">
											<Badge variant={getGameBadgeVariant(item.game)} className="text-xs">
												{getGameDisplayName(item.game)}
											</Badge>
										</div>
									</div>
								</div>
							</div>

							{menuButton}
						</div>
					) : (
						// Rich: the preview card itself is the whole row and the drag
						// target. The menu button lives inside the preview's title row
						// (handedness-aware side) so it reads as the card's own corner
						// action instead of floating in a separate column beside it.
						<div
							{...dragAttributes}
							{...dragListeners}
							className="cursor-grab active:cursor-grabbing select-none"
						>
							<DrawerItemPreview
								item={item}
								headerAction={menuButton}
								headerActionLeft={isLeftHanded}
							/>
						</div>
					)}
				</DragStaticWrapper>
			)}
		</Sortable>
	);
}
