// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { MAX_ZOOM, MIN_ZOOM, clampZoom, screenDeltaToWorld, screenToWorld, zoomToCursor } from './boardCoordinates';

// -- Type Imports --
import type { Viewport } from '@/lib/types/board';

/*
 * Tests for the pure board coordinate math. These pin down the two failure modes the
 * canvas is most sensitive to: a drag that drifts at non-1 zoom (delta must divide by
 * zoom), and a zoom that does not stay centered on the cursor.
 */

const ORIGIN = { left: 100, top: 50 };

describe('screenToWorld', () => {
   it('is the identity (minus the clip origin) at zoom 1, no pan', () => {
      const viewport: Viewport = { x: 0, y: 0, zoom: 1 };
      expect(screenToWorld(300, 250, ORIGIN, viewport)).toEqual({ x: 200, y: 200 });
   });

   it('accounts for pan and zoom', () => {
      const viewport: Viewport = { x: 40, y: 20, zoom: 2 };
      // localX = 300 - 100 = 200; worldX = (200 - 40) / 2 = 80.
      expect(screenToWorld(300, 250, ORIGIN, viewport)).toEqual({ x: 80, y: (250 - 50 - 20) / 2 });
   });
});

describe('screenDeltaToWorld', () => {
   it('divides the screen delta by zoom so a drag tracks the cursor', () => {
      expect(screenDeltaToWorld(10, 20, 1)).toEqual({ x: 10, y: 20 });
      expect(screenDeltaToWorld(10, 20, 0.5)).toEqual({ x: 20, y: 40 }); // zoomed out: world moves more
      expect(screenDeltaToWorld(10, 20, 2)).toEqual({ x: 5, y: 10 }); // zoomed in: world moves less
   });
});

describe('clampZoom', () => {
   it('clamps to the allowed range', () => {
      expect(clampZoom(0.1)).toBe(MIN_ZOOM);
      expect(clampZoom(5)).toBe(MAX_ZOOM);
      expect(clampZoom(1)).toBe(1);
   });
});

describe('zoomToCursor', () => {
   it('keeps the world point under the cursor fixed across the zoom', () => {
      const viewport: Viewport = { x: 30, y: -10, zoom: 1 };
      const screenX = 420;
      const screenY = 260;
      const worldBefore = screenToWorld(screenX, screenY, ORIGIN, viewport);

      const zoomedIn = zoomToCursor(viewport, ORIGIN, screenX, screenY, 1.8);
      const worldAfterIn = screenToWorld(screenX, screenY, ORIGIN, zoomedIn);
      expect(worldAfterIn.x).toBeCloseTo(worldBefore.x, 10);
      expect(worldAfterIn.y).toBeCloseTo(worldBefore.y, 10);

      const zoomedOut = zoomToCursor(viewport, ORIGIN, screenX, screenY, 0.4);
      const worldAfterOut = screenToWorld(screenX, screenY, ORIGIN, zoomedOut);
      expect(worldAfterOut.x).toBeCloseTo(worldBefore.x, 10);
      expect(worldAfterOut.y).toBeCloseTo(worldBefore.y, 10);
   });

   it('clamps the resulting zoom and still holds the cursor point at the clamp', () => {
      const viewport: Viewport = { x: 0, y: 0, zoom: 2 };
      const screenX = 250;
      const screenY = 150;
      const worldBefore = screenToWorld(screenX, screenY, ORIGIN, viewport);

      const result = zoomToCursor(viewport, ORIGIN, screenX, screenY, 10); // would exceed MAX_ZOOM
      expect(result.zoom).toBe(MAX_ZOOM);
      const worldAfter = screenToWorld(screenX, screenY, ORIGIN, result);
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
   });
});
