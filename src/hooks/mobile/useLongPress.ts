import { useRef, useState, useCallback, type TouchEvent } from 'react';

interface Position {
	x: number;
	y: number;
}

export interface UseLongPressOptions {
	/** Fired when the press is held past `delay` without moving beyond `moveTolerance`. Receives the touch-start position. */
	onLongPress: (position: Position) => void;
	/** Optional. Fired when the touch ends before the long-press triggers and without a cancelling move — i.e. a short tap. */
	onTap?: () => void;
	/** How long (ms) the press must be held to count as a long-press. Default 500. */
	delay?: number;
	/** Movement (px, either axis) past which the gesture is cancelled. Default 10. */
	moveTolerance?: number;
	/** Haptic feedback on long-press fire: `true` = 50ms, a number = that many ms, `false` = none. Default `true`. */
	vibrate?: boolean | number;
}

export interface UseLongPressHandlers {
	onTouchStart: (event: TouchEvent) => void;
	onTouchMove: (event: TouchEvent) => void;
	onTouchEnd: (event: TouchEvent) => void;
	onTouchCancel: (event: TouchEvent) => void;
}

export interface UseLongPressResult {
	/** True while a press is active (before it fires, cancels, or ends). Use for press-down visual feedback. */
	isPressing: boolean;
	/** Touch handlers to spread onto the target element. */
	handlers: UseLongPressHandlers;
}

/**
 * Touch long-press detection for mobile surfaces.
 *
 * Owns the press timer, the move-to-cancel guard, the press-down visual flag,
 * and optional haptic feedback. Captures the touch-start position and hands it
 * to `onLongPress` so callers can anchor a context menu where the finger landed.
 * An optional `onTap` distinguishes a short tap (touch ends while still pressing,
 * with no long-press and no cancelling move) — used where a tap has its own
 * meaning, e.g. a folder row that navigates on tap and opens a menu on hold.
 *
 * Touch-only by design (these are mobile-only surfaces); no pointer/mouse fallback.
 *
 * @param options - Long-press configuration (see {@link UseLongPressOptions}).
 * @returns `isPressing` for visual feedback and `handlers` to spread onto the element.
 *
 * @example
 * ```tsx
 * const { isPressing, handlers } = useLongPress({
 *   onLongPress: (pos) => openContextMenu(item.id, item.name, pos),
 *   onTap: () => navigateInto(item.id),
 * });
 *
 * return <div {...handlers} className={cn(isPressing && "scale-95")}>{children}</div>;
 * ```
 */
export function useLongPress({
	onLongPress,
	onTap,
	delay = 500,
	moveTolerance = 10,
	vibrate = true,
}: UseLongPressOptions): UseLongPressResult {
	const [isPressing, setIsPressing] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startPositionRef = useRef<Position | null>(null);
	const isPressingRef = useRef(false);

	const clearTimer = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const onTouchStart = useCallback((event: TouchEvent) => {
		const touch = event.touches[0];
		const position = { x: touch.clientX, y: touch.clientY };
		startPositionRef.current = position;
		isPressingRef.current = true;
		setIsPressing(true);

		timerRef.current = setTimeout(() => {
			if (vibrate && 'vibrate' in navigator) {
				navigator.vibrate(typeof vibrate === 'number' ? vibrate : 50);
			}
			isPressingRef.current = false;
			onLongPress(startPositionRef.current ?? position);
			setIsPressing(false);
			timerRef.current = null;
		}, delay);
	}, [delay, onLongPress, vibrate]);

	const onTouchMove = useCallback((event: TouchEvent) => {
		if (!startPositionRef.current) return;

		const touch = event.touches[0];
		const deltaX = Math.abs(touch.clientX - startPositionRef.current.x);
		const deltaY = Math.abs(touch.clientY - startPositionRef.current.y);

		if (deltaX > moveTolerance || deltaY > moveTolerance) {
			clearTimer();
			isPressingRef.current = false;
			setIsPressing(false);
		}
	}, [clearTimer, moveTolerance]);

	const onTouchEnd = useCallback(() => {
		clearTimer();
		// A tap is a touch that ended while still pressing: neither the long-press
		// timer fired nor a move cancelled it.
		if (isPressingRef.current && onTap) {
			onTap();
		}
		isPressingRef.current = false;
		setIsPressing(false);
		startPositionRef.current = null;
	}, [clearTimer, onTap]);

	const onTouchCancel = useCallback(() => {
		clearTimer();
		isPressingRef.current = false;
		setIsPressing(false);
		startPositionRef.current = null;
	}, [clearTimer]);

	return {
		isPressing,
		handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
	};
}
