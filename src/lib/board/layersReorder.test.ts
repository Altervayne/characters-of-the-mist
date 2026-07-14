// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { buildLayerRows, isMergeableSelection, resolveLayerDrop, LAYERS_ROOT_END } from './layersReorder';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * The layers-panel presentation model: the top-down (front-first) row list, and the pure drop resolver that
 * turns an over-row + before/after side into a `(scope, index)` for the store's reorderItem. The index is
 * measured against the destination scope's siblings with the active item removed - exactly what reorderItem
 * splices into.
 */

function leaf(id: string, z: number, overrides: Partial<BoardItem> = {}): BoardItem {
   return { id, kind: 'post-it', x: 0, y: 0, width: 100, height: 100, z, content: { kind: 'post-it', mode: 'copy', data: { id: `n-${id}`, text: id } }, ...overrides };
}

function zone(id: string, z: number, overrides: Partial<BoardItem> = {}): BoardItem {
   return { id, kind: 'zone', x: 0, y: 0, width: 400, height: 400, z, content: { kind: 'zone', collapsed: false }, ...overrides };
}

function toMap(items: BoardItem[]): Record<string, BoardItem> {
   return Object.fromEntries(items.map((item) => [item.id, item]));
}

describe('buildLayerRows', () => {
   it('lists roots front-first, a zone\'s members nested below its header (also front-first)', () => {
      const map = toMap([leaf('top', 5), zone('Z', 1), leaf('m1', 0, { zoneId: 'Z' }), leaf('m2', 1, { zoneId: 'Z' }), leaf('bottom', 0)]);
      const rows = buildLayerRows(map, new Set());
      expect(rows.map((r) => `${r.item.id}@${r.depth}`)).toEqual(['top@0', 'Z@0', 'm2@1', 'm1@1', 'bottom@0']);
      expect(rows.find((r) => r.item.id === 'm2')!.scopeZoneId).toBe('Z');
   });

   it('hides a collapsed zone\'s members', () => {
      const map = toMap([zone('Z', 0), leaf('m', 0, { zoneId: 'Z' })]);
      const rows = buildLayerRows(map, new Set(['Z']));
      expect(rows.map((r) => r.item.id)).toEqual(['Z']);
   });
});

describe('resolveLayerDrop', () => {
   // Root ascending [a(0), b(1), c(2)] -> top-down [c, b, a].
   const roots = toMap([leaf('a', 0), leaf('b', 1), leaf('c', 2)]);

   it('drops a root item behind another (after = lower)', () => {
      // Drag c below a: c should land at the very back (index 0 among siblings [a, b]).
      expect(resolveLayerDrop(roots, 'c', 'a', 'after')).toEqual({ zoneId: null, index: 0 });
   });

   it('drops a root item in front of another (before = higher)', () => {
      // Drag a above b (between b and c in top-down): index 1 among siblings [b, c].
      expect(resolveLayerDrop(roots, 'a', 'b', 'before')).toEqual({ zoneId: null, index: 1 });
   });

   it('reorders within a zone', () => {
      const map = toMap([zone('Z', 0), leaf('m1', 0, { zoneId: 'Z' }), leaf('m2', 1, { zoneId: 'Z' })]);
      // Drag m1 above m2 (front of the zone): siblings [m2], index 1.
      expect(resolveLayerDrop(map, 'm1', 'm2', 'before')).toEqual({ zoneId: 'Z', index: 1 });
   });

   it('drags a root item INTO a zone by dropping onto the header (front of the zone)', () => {
      const map = toMap([zone('Z', 0), leaf('m', 0, { zoneId: 'Z' }), leaf('x', 5)]);
      // Onto the header, below it: join Z at the front (above its one member).
      expect(resolveLayerDrop(map, 'x', 'Z', 'after')).toEqual({ zoneId: 'Z', index: 1 });
   });

   it('drags a member OUT to root by dropping onto a root row', () => {
      const map = toMap([zone('Z', 0), leaf('m', 0, { zoneId: 'Z' }), leaf('r', 5)]);
      // Onto root row r, below it: leave the zone, land at root behind r. Siblings [Z, r] -> index of r = 1.
      expect(resolveLayerDrop(map, 'm', 'r', 'after')).toEqual({ zoneId: null, index: 1 });
   });

   it('drops above a zone header at root, just in front of the zone', () => {
      const map = toMap([zone('Z', 0), leaf('m', 0, { zoneId: 'Z' }), leaf('r', 5)]);
      // Above the header: stay at root, in front of Z. Siblings [Z, r] -> index of Z (0) + 1 = 1.
      expect(resolveLayerDrop(map, 'r', 'Z', 'before')).toEqual({ zoneId: null, index: 1 });
   });

   it('rejects a zone dropped inside another zone, snapping to a root position', () => {
      const map = toMap([zone('Z1', 0), leaf('m', 0, { zoneId: 'Z1' }), zone('Z2', 1)]);
      // Drag Z2 onto Z1's member: a zone can't nest, so it lands at root adjacent to Z1 (never zoneId: 'Z1').
      const target = resolveLayerDrop(map, 'Z2', 'm', 'before');
      expect(target?.zoneId).toBeNull();
   });

   it('drops a member out the bottom onto the trailing zone (leaves the zone for the back of root)', () => {
      // A zone with nothing below it: the trailing drop zone is the only way out the bottom.
      const map = toMap([zone('Z', 0), leaf('m1', 0, { zoneId: 'Z' }), leaf('m2', 1, { zoneId: 'Z' })]);
      expect(resolveLayerDrop(map, 'm2', LAYERS_ROOT_END, 'before')).toEqual({ zoneId: null, index: 0 });
      expect(resolveLayerDrop(map, 'm2', LAYERS_ROOT_END, 'after')).toEqual({ zoneId: null, index: 0 });
   });

   it('is a no-op on a self drop', () => {
      expect(resolveLayerDrop(roots, 'a', 'a', 'before')).toBeNull();
   });
});

describe('isMergeableSelection', () => {
   function drawing(id: string, z: number, overrides: Partial<BoardItem> = {}): BoardItem {
      return { id, kind: 'drawing', x: 0, y: 0, width: 10, height: 10, z, content: { kind: 'drawing', strokes: [{ id: `s-${id}`, brush: 'pen', color: null, width: 3, points: [0, 0, 1, 1] }] }, ...overrides };
   }
   function connection(id: string, z: number, from: string, to: string): BoardItem {
      return { id, kind: 'connection', x: 0, y: 0, width: 0, height: 0, z, content: { kind: 'connection', from, to, style: { width: 2, color: '#000' } } };
   }

   it('accepts two adjacent drawings', () => {
      const map = toMap([drawing('d1', 0), drawing('d2', 1)]);
      expect(isMergeableSelection(map, new Set(['d1', 'd2']))).toBe(true);
   });

   it('accepts three adjacent drawings in a taller stack', () => {
      const map = toMap([leaf('bottom', 0), drawing('d1', 1), drawing('d2', 2), drawing('d3', 3), leaf('top', 4)]);
      expect(isMergeableSelection(map, new Set(['d1', 'd2', 'd3']))).toBe(true);
   });

   it('rejects a selection under two', () => {
      const map = toMap([drawing('d1', 0), drawing('d2', 1)]);
      expect(isMergeableSelection(map, new Set(['d1']))).toBe(false);
      expect(isMergeableSelection(map, new Set())).toBe(false);
   });

   it('rejects a non-contiguous drawing run (a non-drawing sits between them)', () => {
      const map = toMap([drawing('d1', 0), leaf('mid', 1), drawing('d2', 2)]);
      expect(isMergeableSelection(map, new Set(['d1', 'd2']))).toBe(false);
   });

   it('rejects a selection containing a non-drawing', () => {
      const map = toMap([drawing('d1', 0), leaf('note', 1)]);
      expect(isMergeableSelection(map, new Set(['d1', 'note']))).toBe(false);
   });

   it('rejects when a selected id is a connection (never in the flatten)', () => {
      const map = toMap([drawing('d1', 0), drawing('d2', 1), connection('c', 2, 'd1', 'd2')]);
      expect(isMergeableSelection(map, new Set(['d1', 'c']))).toBe(false);
   });

   it('accepts two adjacent drawings inside the same zone', () => {
      const map = toMap([zone('Z', 0), drawing('d1', 0, { zoneId: 'Z' }), drawing('d2', 1, { zoneId: 'Z' })]);
      expect(isMergeableSelection(map, new Set(['d1', 'd2']))).toBe(true);
   });

   it('rejects two drawings split across a zone boundary (the zone header breaks the run)', () => {
      // Flatten: root d1(0), zone Z(1), member d2. The zone header sits between them -> not contiguous.
      const map = toMap([drawing('d1', 0), zone('Z', 1), drawing('d2', 0, { zoneId: 'Z' })]);
      expect(isMergeableSelection(map, new Set(['d1', 'd2']))).toBe(false);
   });
});
