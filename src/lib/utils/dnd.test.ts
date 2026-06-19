// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { customCollisionDetection } from './dnd';

/*
 * Tests for the drawer-item branch of customCollisionDetection (tabs polish-11, 2a):
 * dropping a drawer item into the current folder body. The branch must let a drop in
 * a DIFFERENT folder than the item's origin (incl. an empty folder reached via
 * spring-nav) resolve to the items-area drop zone, while a same-folder drop still
 * reorders over the nearest item row. The dnd-kit collision primitives read rects
 * from `droppableRects` + `pointerCoordinates`/`collisionRect`, so we build minimal
 * but realistic args.
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

describe('customCollisionDetection — drawer item into the current folder', () => {
   it('resolves the items-area zone when moving into a DIFFERENT folder (over an item row)', () => {
      const result = customCollisionDetection(
         buildArgs({
            originParent: 'origin',
            containers: [container(ZONE), container('item-1', { type: 'drawer-item', parentFolderId: 'dest' })],
            rects: [[ZONE, zoneRect], ['item-1', itemRect]],
            pointer: { x: 100, y: 60 }, // within both the zone and item-1
         }),
      );
      expect(result[0]?.id).toBe(ZONE);
   });

   it('resolves the items-area zone for an EMPTY different folder (no rows)', () => {
      const result = customCollisionDetection(
         buildArgs({
            originParent: 'origin',
            containers: [container(ZONE)],
            rects: [[ZONE, zoneRect]],
            pointer: { x: 100, y: 200 },
         }),
      );
      expect(result[0]?.id).toBe(ZONE);
   });

   it('reorders over the nearest item row for a SAME-folder drop (item wins, not the zone)', () => {
      const result = customCollisionDetection(
         buildArgs({
            originParent: 'dest', // origin === destination folder
            containers: [container(ZONE), container('item-1', { type: 'drawer-item', parentFolderId: 'dest' })],
            rects: [[ZONE, zoneRect], ['item-1', itemRect]],
            pointer: { x: 100, y: 60 },
         }),
      );
      expect(result[0]?.id).toBe('item-1');
   });

   it('treats root correctly: origin root + dest root reorders, origin folder + dest root moves', () => {
      const ROOT_ZONE = 'drawer-drop-zone-root';
      const rootZoneRect = rect(0, 0, 200, 400);
      const rootItemRect = rect(0, 50, 200, 40);

      // Origin is a folder, destination is root → different → zone wins.
      const moveIn = customCollisionDetection(
         buildArgs({
            originParent: 'some-folder',
            containers: [container(ROOT_ZONE), container('item-root', { type: 'drawer-item', parentFolderId: null })],
            rects: [[ROOT_ZONE, rootZoneRect], ['item-root', rootItemRect]],
            pointer: { x: 100, y: 60 },
         }),
      );
      expect(moveIn[0]?.id).toBe(ROOT_ZONE);

      // Origin is root, destination is root → same → reorder over the row.
      const reorder = customCollisionDetection(
         buildArgs({
            originParent: null,
            containers: [container(ROOT_ZONE), container('item-root', { type: 'drawer-item', parentFolderId: null })],
            rects: [[ROOT_ZONE, rootZoneRect], ['item-root', rootItemRect]],
            pointer: { x: 100, y: 60 },
         }),
      );
      expect(reorder[0]?.id).toBe('item-root');
   });
});
