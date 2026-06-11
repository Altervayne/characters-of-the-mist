import { useState, useLayoutEffect } from 'react';

/**
 * Tracks the viewport height (`window.innerHeight`), updating on resize.
 *
 * Starts at `0` and reads the real height synchronously in a layout effect, so
 * the first painted frame already has the correct value. Intended for mobile
 * layout math that must be anchored to the live viewport height (e.g. thumb-zone
 * positioning). Callers should treat `0` as "not measured yet" and guard their math.
 *
 * @returns The current viewport height in pixels (`0` until first measured).
 *
 * @example
 * ```tsx
 * const windowHeight = useWindowHeight();
 * const thumbZoneY = windowHeight ? windowHeight - BOTTOM_OFFSET : 500;
 * ```
 */
export function useWindowHeight(): number {
	const [height, setHeight] = useState(0);

	useLayoutEffect(() => {
		const update = () => setHeight(window.innerHeight);
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	return height;
}
