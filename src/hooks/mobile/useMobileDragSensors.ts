// -- Other Library Imports --
import { useSensor, useSensors, TouchSensor } from '@dnd-kit/core';



/**
 * Builds the shared @dnd-kit sensor set for the mobile drag-to-reorder surfaces
 * (trackers, cards, drawer).
 *
 * Configures a single `TouchSensor` with an activation constraint so a drag only
 * begins after a brief press-and-hold on the drag target, while a quick tap or a
 * scroll fling that moves past the tolerance during the delay cancels into the
 * surface's normal touch behaviour (tap-navigate, list scroll) instead of
 * picking the item up. `delay` is the hold time (ms) before a drag arms;
 * `tolerance` is the movement (px, either axis) allowed during that delay
 * before activation is abandoned in favour of a scroll.
 *
 * Two delay regimes are in use, both passing through this hook:
 *   - **Grip-based surfaces** (trackers, card-reorder): the drag target is a
 *     dedicated grip handle, so a short 150ms delay is enough to differentiate
 *     a deliberate drag from a scroll fling. This is the default.
 *   - **Body-as-handle surfaces** (drawer items / folders): the row body itself
 *     is the drag target, sharing real estate with a tap action (folder navigate)
 *     and a context-menu corner button, so a longer 500ms hold is required to
 *     unambiguously signal "drag this", matching the platform long-press idiom.
 *
 * Touch-only by design: these surfaces are mobile-only, and pointer/mouse drag
 * is owned by the separate desktop DnD subsystem ({@link useCharacterSheetDnD}).
 *
 * @param delay - Hold-time (ms) before a drag arms. Defaults to 150 (grip handles).
 * @returns The memoized sensor descriptors to pass to a mobile `<DndContext>`.
 */
export function useMobileDragSensors(delay: number = 150) {
	return useSensors(
		useSensor(TouchSensor, {
			activationConstraint: { delay, tolerance: 8 },
		})
	);
}
