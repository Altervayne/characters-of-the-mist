// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';
import type { RectLike } from '@/lib/board/boardConnections';

/*
 * Collapsed-zone geometry, shared by the render (the compact bar) and the connection re-anchor.
 * Collapse is render-only: a collapsed zone keeps its stored bounds but paints as a small bar at
 * its origin, and any connection touching a hidden member anchors to that bar instead. None of
 * this rewrites connection data or item geometry - it's resolved fresh each render.
 */

/** The collapsed zone's bar size (world units); the bar paints at the zone's origin. */
export const COLLAPSED_BAR_WIDTH = 220;
export const COLLAPSED_BAR_HEIGHT = 36;

/** The rect a collapsed zone occupies: a bar at its stored origin, fixed size (bounds untouched). */
export function collapsedBarRect(zone: { x: number; y: number }): RectLike {
   return { x: zone.x, y: zone.y, width: COLLAPSED_BAR_WIDTH, height: COLLAPSED_BAR_HEIGHT };
}

/**
 * Resolves a connection endpoint to the item it should anchor to. A hidden member of a collapsed
 * zone (or the collapsed zone item itself) anchors to that zone - the line ends on its bar;
 * everything else anchors to the item as usual. `isBar` tells the caller to use {@link collapsedBarRect}
 * for the geometry; `anchor.id` lets it spot a line whose ends collapse to the same zone.
 */
export function resolveEndpointAnchor(
   item: BoardItem,
   items: Record<string, BoardItem>,
   collapsedZoneIds: ReadonlySet<string>,
): { anchor: BoardItem; isBar: boolean } {
   if (item.kind === 'zone' && collapsedZoneIds.has(item.id)) return { anchor: item, isBar: true };
   if (item.zoneId && collapsedZoneIds.has(item.zoneId)) {
      const zone = items[item.zoneId];
      if (zone) return { anchor: zone, isBar: true };
   }
   return { anchor: item, isBar: false };
}

/**
 * Whether a connection should be hidden while collapsed: both endpoints resolve to the SAME
 * collapsed zone's bar (e.g. two members of one collapsed zone), so the line would be a dot on
 * the bar. The data is untouched, so it returns when the zone expands.
 */
export function isConnectionCollapsedAway(
   fromItem: BoardItem,
   toItem: BoardItem,
   items: Record<string, BoardItem>,
   collapsedZoneIds: ReadonlySet<string>,
): boolean {
   const from = resolveEndpointAnchor(fromItem, items, collapsedZoneIds);
   const to = resolveEndpointAnchor(toItem, items, collapsedZoneIds);
   return from.isBar && to.isBar && from.anchor.id === to.anchor.id;
}
