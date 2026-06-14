// -- React Imports --
import { type ReactNode } from 'react';

// -- Library Imports --
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import SelectableTracker from '@/components/mobile/character-sheet/SelectableTracker';

// -- DnD Component Imports --
import { Sortable, DragLayoutWrapper } from '@/components/dnd';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Icon Imports --
import { GripVertical, CheckCircle2, Circle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Type Imports --
import type { StatusTracker, StoryTagTracker, StoryThemeTracker } from '@/lib/types/character';



interface MobileSortableTrackerProps {
	tracker: StatusTracker | StoryTagTracker | StoryThemeTracker;
	isSelected: boolean;
	onSelect: (id: string) => void;
	isLeftHanded: boolean;
	dragEnabled: boolean;
	children: ReactNode;
}

/**
 * A drag-sortable tracker chip for the mobile character sheet: a grip handle
 * paired with a {@link SelectableTracker} body.
 *
 * The body keeps its existing long-press-to-select-for-the-toolbelt gesture
 * untouched, while a dedicated ≥44px grip handle owns drag-to-reorder. Handle and
 * body are siblings (the long-press handlers live inside `SelectableTracker`), so
 * the @dnd-kit `TouchSensor` and the long-press timer never share an element:
 * dragging the handle never selects, and selecting never starts a drag. The
 * handle is rendered (and dragging enabled) only when `dragEnabled`, matching the
 * trackers' editable state; otherwise the chip behaves exactly as before. The
 * handle sits on the handedness-leading edge and is touch-action: none so an
 * intentional drag is not pre-empted by the trackers list's vertical scroll.
 *
 * A dedicated ≥44px select button on the same handedness-leading side is the
 * always-present button fallback for the long-press-select gesture: tapping it
 * toggles this tracker as the toolbelt's selected tracker, so selection is
 * reachable without the long-press. Unlike the handle, it is shown regardless of
 * `dragEnabled` (selection works in any mode).
 *
 * @param tracker - The tracker rendered in this chip (carries `trackerType` for group-scoped reorder).
 * @param isSelected - Whether this tracker is the toolbelt's selected tracker.
 * @param onSelect - Called with the tracker id on long-press or the select button (select/deselect toggle).
 * @param isLeftHanded - Mirrors the grip handle and select button to the left edge when true.
 * @param dragEnabled - Shows the handle and enables dragging when true.
 * @param children - The tracker card to render inside the selectable body.
 */
export default function MobileSortableTracker({
	tracker,
	isSelected,
	onSelect,
	isLeftHanded,
	dragEnabled,
	children,
}: MobileSortableTrackerProps) {
	const { t } = useTranslation();
	const areGestureHintsEnabled = useAppSettingsStore((state) => state.areGestureHintsEnabled);

	return (
		<Sortable
			id={tracker.id}
			data={{ type: DRAG_TYPES.SHEET_TRACKER, item: tracker }}
			disabled={!dragEnabled}
		>
			{({ dragAttributes, dragListeners, isBeingDragged }) => (
				<DragLayoutWrapper isBeingDragged={isBeingDragged}>
					<div className={cn("flex items-center gap-1", isLeftHanded && "flex-row-reverse")}>
						{/* Select button: always-present fallback for long-press-select */}
						<button
							type="button"
							aria-label={t('MobileGestureHints.selectTracker', { defaultValue: 'Select tracker for actions' })}
							aria-pressed={isSelected}
							onClick={() => onSelect(tracker.id)}
							className={cn(
								"flex shrink-0 items-center justify-center h-11 w-11",
								isSelected ? "text-primary" : "text-muted-foreground"
							)}
						>
							{isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
						</button>

						{dragEnabled && (
							// Keep a drag (which sweeps the finger across the trackers area) from
							// being read as a trackers-area edge-swipe that opens the toolbelt:
							// dnd-kit's own handlers on the button run first and track the drag via
							// document listeners, so stopping the synthetic event from bubbling to
							// the scroll container's swipe detector does not affect dragging.
							<div
								className="shrink-0"
								onTouchStart={(event) => event.stopPropagation()}
								onTouchEnd={(event) => event.stopPropagation()}
							>
								<button
									type="button"
									aria-label={t('Common.dragHandle')}
									className={cn(
										"flex items-center justify-center h-11 w-11 text-muted-foreground touch-none cursor-grab active:cursor-grabbing",
										// Drag affordance cue, gated on the gesture-tips setting.
										areGestureHintsEnabled && "bg-muted/50 rounded-md"
									)}
									{...dragAttributes}
									{...dragListeners}
								>
									<GripVertical className="w-5 h-5" />
								</button>
							</div>
						)}

						<SelectableTracker tracker={tracker} isSelected={isSelected} onSelect={onSelect}>
							{children}
						</SelectableTracker>
					</div>
				</DragLayoutWrapper>
			)}
		</Sortable>
	);
}
