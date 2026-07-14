// -- Local Imports --
import { buildBoardTree, zoneParentId } from './boardTree';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * The layers panel's presentation model over the scope-relative tree: the flat top-down row list it
 * renders (front-first, a zone's members nested under its header), and the pure resolver that turns a
 * drag drop (an over row + a before/after side) into a `(scope, index)` for the store's `reorderItem`.
 * Kept free of React and dnd-kit so the ordering + drop math can be unit-tested in isolation; the panel
 * owns only the gesture wiring.
 */

/** One rendered panel row: the item, its nesting depth, and the scope (zone id, or null for root) it lives in. */
export interface LayerRow {
   item: BoardItem;
   /** 0 for a root item or a zone header; 1 for a nested member. */
   depth: 0 | 1;
   /** True when this row is a zone header (drags its whole band, collapses its members). */
   isZone: boolean;
   /** The scope this row belongs to: null at root, else the parent zone's id. */
   scopeZoneId: string | null;
}

/**
 * The panel's top-down rows (front-first): root items by descending z, and each EXPANDED zone's members
 * nested (descending z) beneath its header. A collapsed zone contributes only its header. Mirrors
 * {@link buildBoardTree} reversed, so the first row is the front-most element and the list reads top-to-
 * bottom exactly like the canvas paints back-to-front.
 */
export function buildLayerRows(items: Record<string, BoardItem>, collapsedZoneIds: ReadonlySet<string>): LayerRow[] {
   const rows: LayerRow[] = [];
   // buildBoardTree is ascending (back -> front); reverse for the panel's front-first reading.
   for (const node of [...buildBoardTree(items)].reverse()) {
      const isZone = node.item.kind === 'zone';
      rows.push({ item: node.item, depth: 0, isZone, scopeZoneId: null });
      if (!isZone || collapsedZoneIds.has(node.item.id)) continue;
      for (const member of [...node.members].reverse()) {
         rows.push({ item: member, depth: 1, isZone: false, scopeZoneId: node.item.id });
      }
   }
   return rows;
}

/** A resolved drop: the destination scope (null = root) and the ascending index within it. */
export interface LayerDropTarget {
   zoneId: string | null;
   index: number;
}

/**
 * The droppable id of the trailing zone below every group. Dropping here leaves any zone for the back of
 * the root stack - the only way to pull a member out the BOTTOM of a zone that has nothing below it.
 */
export const LAYERS_ROOT_END = 'layers-root-end';

/** The ascending (back -> front) member list of a scope: root items, or a zone's own members. */
function scopeAscending(items: Record<string, BoardItem>, zoneId: string | null): BoardItem[] {
   const tree = buildBoardTree(items);
   if (zoneId === null) return tree.map((node) => node.item);
   return tree.find((node) => node.item.id === zoneId)?.members ?? [];
}

/**
 * Resolves a panel drop into `(scope, ascending-index)` for {@link import('@/lib/stores/boardStore').BoardStore}'s
 * `reorderItem`. `position` is the side of `overId` the insertion line sits on in the TOP-DOWN list: `before`
 * = above (more front / higher z), `after` = below (more back / lower z). The index is measured against the
 * destination scope's siblings WITH the active item removed, matching `reorderItem`'s splice.
 *
 * Scope rules: a member row keeps the drop inside its zone; a root row keeps it at root; dropping onto a zone
 * header lands at the front of that zone (`after`) or at root just in front of it (`before`). A **zone** being
 * dragged can never nest, so it always resolves to a root position (snapping to the nearest legal root anchor).
 * Returns null for a degenerate drop (missing rows, or a self drop).
 */
export function resolveLayerDrop(
   items: Record<string, BoardItem>,
   activeId: string,
   overId: string,
   position: 'before' | 'after',
): LayerDropTarget | null {
   // The trailing drop zone: leave any zone for the back of the root stack (the escape hatch for a member
   // out the bottom of a zone that has nothing below it). Ignores `position` - it's a single target.
   if (overId === LAYERS_ROOT_END) {
      const dragged = items[activeId];
      if (!dragged || dragged.kind === 'connection') return null;
      return { zoneId: null, index: 0 };
   }
   if (activeId === overId) return null;
   const active = items[activeId];
   const over = items[overId];
   if (!active || !over || active.kind === 'connection' || over.kind === 'connection') return null;

   // A dragged zone can only live at root (nesting forbidden): snap to the root row anchoring the drop -
   // the over row itself when it's a root item/header, else the header of the zone the over member belongs to.
   if (active.kind === 'zone') {
      const overScope = zoneParentId(over, items);
      const anchorId = overScope ?? over.id;
      const siblings = scopeAscending(items, null).filter((item) => item.id !== activeId);
      const idx = siblings.findIndex((item) => item.id === anchorId);
      if (idx < 0) return null;
      return { zoneId: null, index: position === 'before' ? idx + 1 : idx };
   }

   // Dropping onto a zone HEADER: below it (after) joins the zone at its front; above it (before) stays at
   // root, just in front of the zone.
   if (over.kind === 'zone') {
      if (position === 'after') {
         const siblings = scopeAscending(items, over.id).filter((item) => item.id !== activeId);
         return { zoneId: over.id, index: siblings.length };
      }
      const siblings = scopeAscending(items, null).filter((item) => item.id !== activeId);
      const idx = siblings.findIndex((item) => item.id === over.id);
      if (idx < 0) return null;
      return { zoneId: null, index: idx + 1 };
   }

   // Over a plain row (a root item or a member): the drop stays in that row's scope.
   const scope = zoneParentId(over, items);
   const siblings = scopeAscending(items, scope).filter((item) => item.id !== activeId);
   const idx = siblings.findIndex((item) => item.id === overId);
   if (idx < 0) return null;
   return { zoneId: scope, index: position === 'before' ? idx + 1 : idx };
}
