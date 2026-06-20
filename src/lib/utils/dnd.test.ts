// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { customCollisionDetection } from './dnd';

/*
 * Tests for the drawer-item branch of customCollisionDetection. As of tabs polish-15
 * the in-drawer MOVE targets (folder rows, Back, the items-area drop zone) are resolved
 * by the live-geometry resolver at drop, NOT by this collision — so the branch's only
 * remaining in-drawer job is same-folder REORDER over the nearest item row (closestCenter).
 * These tests pin that: the items-area zone is never returned, the nearest item row is,
 * and an empty folder body yields no collision (the resolver lands the drop). The dnd-kit
 * collision primitives read rects from `droppableRects` + `pointerCoordinates`/
 * `collisionRect`, so we build minimal but realistic args.
 */

type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };
const rect = (left: number, top: number, width: number, height: number): Rect => ({
   left,
   top,
   right: left + width,
   bottom: top + height,
   width,
   height,
});

interface Container {
   id: string;
   data: { current: Record<string, unknown> | undefined };
}
const container = (id: string, data?: Record<string, unknown>): Container => ({ id, data: { current: data } });

/** Builds a collision-detection args object for a drawer-item drag. */
function buildArgs(params: {
   originParent: string | null;
   containers: Container[];
   rects: Array<[string, Rect]>;
   pointer: { x: number; y: number };
}) {
   const args = {
      active: { id: 'dragged-item', data: { current: { type: 'drawer-item', parentFolderId: params.originParent } } },
      collisionRect: rect(params.pointer.x - 10, params.pointer.y - 10, 20, 20),
      droppableRects: new Map<string, Rect>(params.rects),
      droppableContainers: params.containers,
      pointerCoordinates: params.pointer,
   };
   return args as unknown as Parameters<typeof customCollisionDetection>[0];
}

const ZONE = 'drawer-drop-zone-dest';
const zoneRect = rect(0, 0, 200, 400);
const itemRect = rect(0, 50, 200, 40);

describe('customCollisionDetection — drawer item (reorder only; in-drawer moves are resolver-driven)', () => {
   it('returns the nearest item ROW for a same-folder drop, never the items-area zone', () => {
      const result = customCollisionDetection(
         buildArgs({
            originParent: 'dest', // origin === destination folder
            containers: [container(ZONE), container('item-1', { type: 'drawer-item', parentFolderId: 'dest' })],
            rects: [[ZONE, zoneRect], ['item-1', itemRect]],
            pointer: { x: 100, y: 60 }, // within both the zone and item-1
         }),
      );
      expect(result[0]?.id).toBe('item-1');
      expect(result.some((c) => c.id === ZONE)).toBe(false);
   });

   it('still resolves to the item row across folders — the MOVE itself is resolver-driven at drop', () => {
      const result = customCollisionDetection(
         buildArgs({
            originParent: 'origin', // different from the row's folder
            containers: [container(ZONE), container('item-1', { type: 'drawer-item', parentFolderId: 'dest' })],
            rects: [[ZONE, zoneRect], ['item-1', itemRect]],
            pointer: { x: 100, y: 60 },
         }),
      );
      expect(result[0]?.id).toBe('item-1');
      expect(result.some((c) => c.id === ZONE)).toBe(false);
   });

   it('returns no collision over an EMPTY folder body (no rows) — the resolver lands the drop', () => {
      const result = customCollisionDetection(
         buildArgs({
            originParent: 'origin',
            containers: [container(ZONE)],
            rects: [[ZONE, zoneRect]],
            pointer: { x: 100, y: 200 },
         }),
      );
      expect(result).toHaveLength(0);
   });
});
