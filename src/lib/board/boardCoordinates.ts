// -- Type Imports --
import type { Viewport } from '@/lib/types/board';

/*
 * Pure world<->screen math for the board canvas. The world layer is rendered with
 * `transform: translate(viewport.x, viewport.y) scale(viewport.zoom)` and
 * `transform-origin: 0 0`, so every conversion here follows from that single transform.
 * Move, resize, zoom-to-cursor, and add-at-center all route through these helpers so
 * they can never disagree.
 */

/** The clamped zoom range for the canvas. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

/** The minimal screen-space offset (left/top) of the clip layer, from its bounding rect. */
export interface ClipOrigin {
   left: number;
   top: number;
}

/** Clamps a zoom value into {@link MIN_ZOOM}..{@link MAX_ZOOM}. */
export function clampZoom(zoom: number): number {
   return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Converts an absolute screen point (e.g. `event.clientX/Y`) to a world point, given the
 * clip layer's origin and the current viewport.
 */
export function screenToWorld(screenX: number, screenY: number, origin: ClipOrigin, viewport: Viewport): { x: number; y: number } {
   return {
      x: (screenX - origin.left - viewport.x) / viewport.zoom,
      y: (screenY - origin.top - viewport.y) / viewport.zoom,
   };
}

/**
 * Converts a screen-space delta (how far the cursor moved on screen) to a world-space
 * delta. This is what makes a drag track the cursor at any zoom: a 10px screen move at
 * zoom 2 is only 5 world units.
 */
export function screenDeltaToWorld(deltaX: number, deltaY: number, zoom: number): { x: number; y: number } {
   return { x: deltaX / zoom, y: deltaY / zoom };
}

/**
 * Returns the viewport after a wheel zoom toward the cursor: the zoom is set to
 * `nextZoom` (clamped), and `x/y` are adjusted so the world point under the cursor stays
 * under the cursor.
 */
export function zoomToCursor(
   viewport: Viewport,
   origin: ClipOrigin,
   screenX: number,
   screenY: number,
   nextZoom: number,
): Viewport {
   const zoom = clampZoom(nextZoom);
   // The cursor's position within the clip layer (local screen coords).
   const localX = screenX - origin.left;
   const localY = screenY - origin.top;
   // The world point currently under the cursor must map back to the same local point
   // after the zoom: local = world * zoom + offset  =>  offset = local - world * zoom.
   const worldX = (localX - viewport.x) / viewport.zoom;
   const worldY = (localY - viewport.y) / viewport.zoom;
   return {
      zoom,
      x: localX - worldX * zoom,
      y: localY - worldY * zoom,
   };
}
