/*
 * Ring-angle math for the board's right-click radial menu: where each segment sits on the circle.
 * Pure (no React), so the geometry is unit-testable and the menu component stays a clean
 * component-only module (fast-refresh friendly).
 */

/**
 * The screen offset (from the ring center) of button `i` of `n`, evenly spaced: the first sits at
 * the top (12 o'clock) and they run clockwise. `angleOffsetDeg` rotates the whole ring by that many
 * degrees (clockwise) - the conveyor-in animates it from a small sweep down to 0, so buttons roll
 * into their slots along the arc rather than sliding in a straight line. Defaults to 0 (no offset).
 */
export function radialOffset(i: number, n: number, radius: number, angleOffsetDeg = 0): { x: number; y: number } {
   const angle = ((-90 + (i * 360) / n + angleOffsetDeg) * Math.PI) / 180;
   return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Target chord (px) between adjacent buttons, and the radius clamp the spacing is held within. */
const TARGET_CHORD = 72;
const MIN_RADIUS = 48;
const MAX_RADIUS = 110;

/**
 * The ring radius for `count` buttons: sized so adjacent buttons keep a roughly constant gap rather
 * than flinging a few options far apart on a fixed circle. A handful sit on a tight ring; more
 * options open it up, clamped so it never collapses onto the center or grows unwieldy.
 */
export function ringRadius(count: number): number {
   if (count <= 1) return MIN_RADIUS;
   const ideal = TARGET_CHORD / (2 * Math.sin(Math.PI / count));
   return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, ideal));
}
