// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Folder, GripVertical, MoreHorizontal } from 'lucide-react';

// -- Component Imports --
import { FolderCountLabel } from '@/components/mobile/shared/FolderCountLabel';

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
import type { Folder as FolderType } from '@/lib/types/drawer';



interface MobileFolderItemProps {
	folder: FolderType;
	onNavigate: (folderId: string) => void;
	onLongPress: (folderId: string, folderName: string, position: { x: number; y: number }) => void;
	isLeftHanded: boolean;
}

/**
 * A drawer folder row on mobile: a drag handle plus a tappable body.
 *
 * The body retains the established touch gestures via {@link useLongPress} -
 * tap navigates into the folder, long-press opens the context menu - while the
 * dedicated ≥44px grip handle owns drag-to-reorder. Because the handle and the
 * body are siblings (the long-press handlers are spread only on the body), the
 * @dnd-kit `TouchSensor` and the long-press timer never share an element, so
 * dragging from the handle never triggers navigation or the menu, and vice
 * versa. The handle sits on the handedness-leading edge (right by default, left
 * when left-handed) and is touch-action: none so an intentional drag is not
 * pre-empted by the list's vertical scroll.
 *
 * A trailing overflow (⋮) button is the always-present button fallback for the
 * long-press context menu (it opens the same menu, anchored at the button), so
 * the menu is reachable without the long-press gesture.
 *
 * @param folder - The folder to render.
 * @param onNavigate - Called with the folder id when the body is tapped.
 * @param onLongPress - Called with the folder id, name, and a screen position to anchor the context menu (long-press or overflow button).
 * @param isLeftHanded - Places the grip on the handedness-leading edge: right for right-handed (default), left when true.
 */
export default function MobileFolderItem({
	folder,
	onNavigate,
	onLongPress,
	isLeftHanded,
}: MobileFolderItemProps) {
	const { t } = useTranslation();
	const areGestureHintsEnabled = useAppSettingsStore((state) => state.areGestureHintsEnabled);
	const { isPressing, handlers } = useLongPress({
		onLongPress: (position) => onLongPress(folder.id, folder.name, position),
		onTap: () => onNavigate(folder.id),
	});

	// Calculate total items in folder (including nested)
	const totalItems = folder.items.length;
	const totalSubfolders = folder.folders.length;

	return (
		<Sortable id={folder.id} data={{ type: DRAG_TYPES.DRAWER_FOLDER, item: folder }}>
			{({ dragAttributes, dragListeners, isBeingDragged }) => (
				<DragStaticWrapper isBeingDragged={isBeingDragged}>
					<div
						className={cn(
							"flex items-center rounded-lg border border-border bg-card overflow-hidden transition-all",
							// Controls sit on the handedness-leading edge: grip leads (right for
							// right-handed, left for left-handed), overflow on the trailing edge.
							!isLeftHanded && "flex-row-reverse",
							// Press feedback lives on the whole row so grip, body, and overflow
							// animate as one unit.
							isPressing && "scale-[0.98] bg-muted"
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

						{/* Body: tap navigates, long-press opens the context menu */}
						<div
							{...handlers}
							className={cn(
								"flex flex-1 min-w-0 items-center gap-2 p-2 min-h-11 transition-all",
								"active:scale-[0.98] cursor-pointer"
							)}
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

						{/* Overflow button: always-present fallback for the long-press menu */}
						<button
							type="button"
							aria-label={t('Common.moreOptions')}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								onLongPress(folder.id, folder.name, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
							}}
							className="flex shrink-0 items-center justify-center h-11 w-11 text-muted-foreground"
						>
							<MoreHorizontal className="w-5 h-5" />
						</button>
					</div>
				</DragStaticWrapper>
			)}
		</Sortable>
	);
}
