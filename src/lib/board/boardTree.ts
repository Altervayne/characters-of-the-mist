// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * The board's scope-relative z / tree model. An item's `z` is its order WITHIN its scope - the root
 * scope when it has no zone, else its zone. Paint order is derived by FLATTENING that tree, never by a
 * global z-sort: root items ascend by z, and each zone is immediately followed by its own members
 * (ascending by z), so a zone's members always band contiguously with it. This one ordering is the
 * single source both the canvas render rank and the layers panel consume.
 *
 * Two levels only: root items (zones included) and a zone's members. A zone is NEVER a member of another
 * zone (nesting is forbidden), so it is always a root scope owner; a member is always a non-zone item
 * whose `zoneId` names a live zone. A dangling `zoneId` (its zone was deleted, or names a non-zone) reads
 * as rootless, so the item still appears - at root - rather than vanishing. Connections carry no paint
 * rank and are excluded throughout.
 */

/**
 * The id of `item`'s live zone parent, or `null` when it has none. A zone-kind or connection item is
 * never a member; a `zoneId` that names a missing item or a non-zone is treated as no parent.
 */
export function zoneParentId(item: BoardItem, items: Record<string, BoardItem>): string | null {
   if (item.kind === 'zone' || item.kind === 'connection') return null;
   const parentId = item.zoneId;
   if (!parentId) return null;
   const parent = items[parentId];
   return parent && parent.kind === 'zone' ? parentId : null;
}

/** Orders a scope: by stored z, then by id so equal-z items (legacy data) stay deterministic. */
export function byZThenId(a: BoardItem, b: BoardItem): number {
   if (a.z !== b.z) return a.z - b.z;
   return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** A root item plus, when it is a zone, its members ascending in the zone's scope (empty otherwise). */
export interface BoardTreeNode {
   item: BoardItem;
   members: BoardItem[];
}

/**
 * The scope-relative tree (bottom -> top): root items by ascending z, each zone carrying its own members
 * (ascending z within the zone). Connections are excluded (they paint in their own SVG band). This is the
 * grouped shape the layers panel renders; {@link flattenBoardOrder} is its depth-first flattening, so the
 * two never disagree about order.
 */
export function buildBoardTree(items: Record<string, BoardItem>): BoardTreeNode[] {
   const membersByZone = new Map<string, BoardItem[]>();
   const roots: BoardItem[] = [];
   for (const item of Object.values(items)) {
      if (item.kind === 'connection') continue;
      const parentId = zoneParentId(item, items);
      if (parentId) {
         const bucket = membersByZone.get(parentId);
         if (bucket) bucket.push(item);
         else membersByZone.set(parentId, [item]);
      } else {
         roots.push(item);
      }
   }
   roots.sort(byZThenId);
   return roots.map((root) => {
      if (root.kind !== 'zone') return { item: root, members: [] };
      const members = membersByZone.get(root.id) ?? [];
      members.sort(byZThenId);
      return { item: root, members };
   });
}

/**
 * The scope-relative paint order (bottom -> top) for `items`: root items by ascending z, each zone
 * immediately followed by its members (ascending z within the zone). Connections are excluded (they
 * paint in their own SVG band). Works on ANY stored z - contiguity is derived here, not required of the
 * data - so the order is correct before and after the one-time {@link repairBoardZ}.
 */
export function flattenBoardOrder(items: Record<string, BoardItem>): BoardItem[] {
   const order: BoardItem[] = [];
   for (const node of buildBoardTree(items)) {
      order.push(node.item);
      order.push(...node.members);
   }
   return order;
}

/**
 * The z for a new item landing at the FRONT of its destination scope: `max(z) + 1` among the items sharing
 * `zoneId` (root scope when `null`), else 0. Keeps a fresh item's z dense within its scope rather than at a
 * global maximum, so a new zone member ranks just above its siblings instead of at a sparse global peak.
 * Connections carry no paint rank, so they never count toward a scope's front.
 */
export function nextScopeZ(items: Record<string, BoardItem>, zoneId: string | null): number {
   let max = -Infinity;
   for (const item of Object.values(items)) {
      if (item.kind === 'connection') continue;
      if ((item.zoneId ?? null) === zoneId) max = Math.max(max, item.z);
   }
   return max === -Infinity ? 0 : max + 1;
}

/**
 * Renormalizes stored z to dense, scope-relative order: the root scope (root items, zones included) to
 * 0..k by current z, and each zone's members to 0..m by current z, preserving each scope's existing
 * relative order. A zone band's contiguity is a derived fact of {@link flattenBoardOrder}, not of stored
 * z, so this is pure tidiness - it only lets later reorders start from dense z. Idempotent: an already-
 * dense board maps every id to its current z, so `changed` comes back empty. Connections are left as-is.
 */
export function repairBoardZ(items: Record<string, BoardItem>): { items: Record<string, BoardItem>; changed: { id: string; z: number }[] } {
   // Bucket every non-connection item by scope ('' = root, else the zone id).
   const scopes = new Map<string, BoardItem[]>();
   for (const item of Object.values(items)) {
      if (item.kind === 'connection') continue;
      const key = zoneParentId(item, items) ?? '';
      const bucket = scopes.get(key);
      if (bucket) bucket.push(item);
      else scopes.set(key, [item]);
   }
   const next: Record<string, BoardItem> = { ...items };
   const changed: { id: string; z: number }[] = [];
   for (const bucket of scopes.values()) {
      bucket.sort(byZThenId);
      bucket.forEach((item, index) => {
         if (item.z === index) return;
         next[item.id] = { ...item, z: index };
         changed.push({ id: item.id, z: index });
      });
   }
   return { items: next, changed };
}
