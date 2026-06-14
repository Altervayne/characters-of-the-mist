// -- Other Library Imports --
import { useSensor, useSensors, TouchSensor } from '@dnd-kit/core';



/**
 * Builds the shared @dnd-kit sensor set for the mobile drag-to-reorder surfaces
 * (trackers, cards, drawer).
 *
 * Configures a single `TouchSensor` with an activation constraint so a drag only
 * begins after a brief press-and-hold on a drag handle, while a quick tap or a
 * scroll fling that moves past the tolerance during the delay cancels into the
 * surface's normal touch behaviour (tap-navigate, long-press menu, list scroll)
 * instead of picking the item up. `delay` is the hold time (ms) before a drag
 * arms; `tolerance` is the movement (px, either axis) allowed during that delay
 * before activation is abandoned in favour of a scroll.
 *
 * Touch-only by design: these surfaces are mobile-only, and pointer/mouse drag
 * is owned by the separate desktop DnD subsystem ({@link useCharacterSheetDnD}).
 *
 * @returns The memoized sensor descriptors to pass to a mobile `<DndContext>`.
 */
export function useMobileDragSensors() {
	return useSensors(
		useSensor(TouchSensor, {
			activationConstraint: { delay: 150, tolerance: 8 },
		})
	);
}
