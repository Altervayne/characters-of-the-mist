/**
 * Reads the bottom safe-area inset (the home-indicator gutter) in CSS pixels.
 *
 * `env(safe-area-inset-bottom)` cannot be read directly from JavaScript, so this applies it to a
 * throwaway off-screen element's padding and reads back the resolved computed length. Returns 0 on
 * devices/browsers without an inset (or when the document does not set `viewport-fit=cover`). Used to
 * keep finger-anchored menus clear of the home indicator when clamping them on-screen.
 *
 * @returns The bottom safe-area inset in pixels (0 when none applies).
 */
export function readSafeAreaInsetBottom(): number {
   const probe = document.createElement('div');
   probe.style.position = 'absolute';
   probe.style.visibility = 'hidden';
   probe.style.paddingBottom = 'env(safe-area-inset-bottom)';
   document.body.appendChild(probe);
   const inset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
   document.body.removeChild(probe);
   return inset;
}
