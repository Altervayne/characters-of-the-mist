// -- Other Library Imports --
import cuid from 'cuid';

// -- Repository Imports --
import { getItem } from '@/lib/drawer/drawerRepository';

// -- Board Imports --
import { embeddedSpecForDrawerItem } from './embedDrawerItem';
import { getActiveBoardStore } from './boardStoreRegistry';
import { zoneContaining } from './zoneMembership';

// -- Type Imports --
import type { EmbeddedBoardSpec } from './embedDrawerItem';
import type { BoardItem } from '@/lib/types/board';

/*
 * The Portals spawn-beside service: for a tabless ELEMENT link clicked inside a note EMBEDDED on a board,
 * it drops that drawer element onto the SAME board, beside the origin note tile. Mirrors
 * `BoardView.embedNoteAt` (drawer read -> `embeddedSpecForDrawerItem` -> `addItem`), placing the new item
 * to the right of the origin instead of at a cursor point, and joining a zone it lands in like a drop does.
 */

/** World gap between the origin tile's right edge and the spawned neighbor's left edge. */
const GAP = 24;
/** Diagonal shove applied per collision so repeated spawns onto the same spot fan out instead of stacking. */
const OVERLAP_NUDGE = 24;

/** The minimal geometry the placement needs from the origin item and the existing board items. */
interface Placed {
   x: number;
   y: number;
   width: number;
   height: number;
}

/**
 * Computes the top-left for an element spawned beside `origin`: to its right (`x = origin.x + width + GAP`,
 * `y = origin.y`), nudged diagonally while it would land exactly on an existing item so a double-spawn
 * doesn't perfectly overlap. Pure - the board read + write live in {@link spawnDrawerItemBeside}.
 */
export function besidePlacement(origin: Placed, spec: { width: number; height: number }, existing: Placed[]): Placed {
   let x = origin.x + origin.width + GAP;
   let y = origin.y;
   while (existing.some((item) => Math.abs(item.x - x) < 1 && Math.abs(item.y - y) < 1)) {
      x += OVERLAP_NUDGE;
      y += OVERLAP_NUDGE;
   }
   return { x, y, width: spec.width, height: spec.height };
}

// Reentrancy guard, keyed by origin+target: a double-click on one link fires the handler twice, but only
// the first spawn runs (the second bails until the first's async addItem settles). Distinct links spawn freely.
const inFlight = new Set<string>();

/**
 * Spawns the drawer element `drawerItemId` beside the board item `originItemId` on the active board, as ONE
 * undoable `addItem`. A dead/missing drawer item (or an undroppable one) calls `onMissing` and no-ops; no
 * active board, or a vanished origin item, is a silent no-op. Guarded so a double-click spawns exactly once.
 */
export async function spawnDrawerItemBeside(drawerItemId: string, originItemId: string, onMissing: () => void): Promise<void> {
   const key = `${originItemId}:${drawerItemId}`;
   if (inFlight.has(key)) return;
   inFlight.add(key);
   try {
      const store = getActiveBoardStore();
      if (!store) return;
      const origin = store.getState().items[originItemId];
      if (!origin) return;

      const item = await getItem(drawerItemId);
      if (!item) {
         onMissing();
         return;
      }
      const spec: EmbeddedBoardSpec | null = embeddedSpecForDrawerItem(item);
      if (!spec) {
         onMissing();
         return;
      }

      const items = Object.values(store.getState().items);
      const z = items.length > 0 ? Math.max(...items.map((existing) => existing.z)) + 1 : 0;
      const placement = besidePlacement(origin, spec, items);
      const zoneItems = items.filter((existing) => existing.kind === 'zone');
      const zoneId = zoneContaining({ id: '', ...placement }, zoneItems) ?? undefined;
      const newItem: BoardItem = { id: cuid(), kind: spec.kind, ...placement, z, zoneId, content: spec.content };
      await store.getState().actions.addItem(newItem);
   } finally {
      inFlight.delete(key);
   }
}
