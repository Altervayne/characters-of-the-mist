// -- Local Imports --
import { MIN_ITEM_SIZE } from './boardResize';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * Geometric zone membership: an item belongs to the zone whose rectangle contains the item's
 * CENTER. Membership is captured when the item lands (move-end / drop / create), never recomputed
 * every frame, and is stored on the item (`zoneId`). This module is the single source of that rule;
 * the store calls it on the moved/created item, then persists the resulting `zoneId` change.
 */

/** The minimal placement a containment test needs (the item's own id, to never match itself). */
interface Placed {
   id: string;
   x: number;
   y: number;
   width: number;
   height: number;
}

/**
 * The id of the zone containing `item`'s center, or `null` if none. When several zones overlap the
 * center, the topmost (highest `z`) wins - matching what the user sees on top. A zone never contains
 * itself, and zones are never members of zones (no nesting), so zone items are skipped as candidates.
 * A COLLAPSED zone is skipped too: it has no open interior (it renders as a bar), so nothing can be
 * dropped into it - membership is only captured against expanded frames.
 */
export function zoneContaining(item: Placed, zones: BoardItem[]): string | null {
   const cx = item.x + item.width / 2;
   const cy = item.y + item.height / 2;
   let bestId: string | null = null;
   let bestZ = -Infinity;
   for (const zone of zones) {
      if (zone.kind !== 'zone' || zone.id === item.id) continue;
      if (zone.content.kind === 'zone' && zone.content.collapsed) continue;
      const inside = cx >= zone.x && cx <= zone.x + zone.width && cy >= zone.y && cy <= zone.y + zone.height;
      if (inside && zone.z > bestZ) {
         bestZ = zone.z;
         bestId = zone.id;
      }
   }
   return bestId;
}

/**
 * The smallest a zone may be resized to: from its origin to the farthest member right/bottom edge,
 * so the frame never shrinks out from under its contents. Resize is bottom-right with x/y pinned, so
 * only the right/bottom extent constrains it; each axis floors at {@link MIN_ITEM_SIZE}, and a zone
 * with no members floors at {@link MIN_ITEM_SIZE} on both. `members` are the items whose `zoneId`
 * is this zone's id.
 */
export function zoneContentMinSize(zone: { x: number; y: number }, members: BoardItem[]): { width: number; height: number } {
   let width = MIN_ITEM_SIZE;
   let height = MIN_ITEM_SIZE;
   for (const member of members) {
      width = Math.max(width, member.x + member.width - zone.x);
      height = Math.max(height, member.y + member.height - zone.y);
   }
   return { width, height };
}
