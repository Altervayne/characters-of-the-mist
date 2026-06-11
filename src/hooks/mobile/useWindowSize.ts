import { useState, useEffect } from 'react';

interface WindowSize {
	width: number;
	height: number;
}

/**
 * Tracks the viewport width and height, updating on resize.
 *
 * Unlike {@link useWindowHeight}, this initialises lazily from the real window
 * dimensions (falling back to `0` when `window` is unavailable, e.g. SSR), so the
 * first render already carries valid values and avoids a position flash. Callers
 * that must not render before measurement can still guard on a `0` dimension.
 *
 * @returns The current `{ width, height }` of the viewport in pixels.
 *
 * @example
 * ```tsx
 * const { width, height } = useWindowSize();
 * if (width === 0 || height === 0) return null; // not measured yet
 * ```
 */
export function useWindowSize(): WindowSize {
	const [size, setSize] = useState<WindowSize>(() => ({
		width: typeof window !== 'undefined' ? window.innerWidth : 0,
		height: typeof window !== 'undefined' ? window.innerHeight : 0,
	}));

	useEffect(() => {
		const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	return size;
}
