// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { buildBoardTree, flattenBoardOrder, nextScopeZ, repairBoardZ } from './boardTree';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * The scope-relative tree flatten + the one-time z repair. The flatten is the single paint order both
 * the canvas rank and the layers panel consume: root items by z, each zone immediately followed by its
 * members (contiguous band), connections excluded. The repair densifies each scope's z, idempotently.
 */

function leaf(id: string, z: number, overrides: Partial<BoardItem> = {}): BoardItem {
   return { id, kind: 'post-it', x: 0, y: 0, width: 100, height: 100, z, content: { kind: 'post-it', mode: 'copy', data: { id: `n-${id}`, text: id } }, ...overrides };
}

function zone(id: string, z: number, overrides: Partial<BoardItem> = {}): BoardItem {
   return { id, kind: 'zone', x: 0, y: 0, width: 400, height: 400, z, content: { kind: 'zone', collapsed: false }, ...overrides };
}

function connection(id: string, z: number): BoardItem {
   return { id, kind: 'connection', x: 0, y: 0, width: 0, height: 0, z, content: { kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#000' } } };
}

/** Keys an item list by id into the store's `items` shape. */
function toMap(items: BoardItem[]): Record<string, BoardItem> {
   return Object.fromEntries(items.map((item) => [item.id, item]));
}

/** The flatten as a list of ids, for terse ordering assertions. */
function orderIds(items: BoardItem[]): string[] {
   return flattenBoardOrder(toMap(items)).map((item) => item.id);
}

describe('flattenBoardOrder', () => {
   it('with NO zones matches a plain ascending z-sort', () => {
      const items = [leaf('a', 2), leaf('b', 0), leaf('c', 1)];
      expect(orderIds(items)).toEqual(['b', 'c', 'a']);
   });

   it('places a zone immediately before its members, ascending within the zone', () => {
      const items = [leaf('top', 5), zone('Z', 1), leaf('m1', 0, { zoneId: 'Z' }), leaf('m2', 1, { zoneId: 'Z' }), leaf('bottom', 0)];
      // Root order by z: bottom(0), Z(1), top(5). Z's members band right after Z, ascending.
      expect(orderIds(items)).toEqual(['bottom', 'Z', 'm1', 'm2', 'top']);
   });

   it('bands each of several zones with its own members, in root z order', () => {
      const items = [
         zone('Z1', 0),
         zone('Z2', 2),
         leaf('free', 1),
         leaf('a1', 0, { zoneId: 'Z1' }),
         leaf('a2', 1, { zoneId: 'Z1' }),
         leaf('b1', 0, { zoneId: 'Z2' }),
      ];
      expect(orderIds(items)).toEqual(['Z1', 'a1', 'a2', 'free', 'Z2', 'b1']);
   });

   it('emits an empty zone as a lone root item (no trailing band)', () => {
      const items = [zone('Z', 0), leaf('x', 1)];
      expect(orderIds(items)).toEqual(['Z', 'x']);
   });

   it('orders members by their stored z even when the map order disagrees', () => {
      // Members inserted out of z order; the flatten still emits them ascending.
      const items = [zone('Z', 0), leaf('m3', 3, { zoneId: 'Z' }), leaf('m1', 1, { zoneId: 'Z' }), leaf('m2', 2, { zoneId: 'Z' })];
      expect(orderIds(items)).toEqual(['Z', 'm1', 'm2', 'm3']);
   });

   it('excludes connections from the order', () => {
      const items = [leaf('a', 0), connection('c', 1), leaf('b', 2)];
      expect(orderIds(items)).toEqual(['a', 'b']);
   });

   it('never nests a zone: a zone carrying a zoneId still ranks at root, not as a member', () => {
      // Data corruption guard: a zone with a stray zoneId must NOT be pulled into another zone's band.
      const items = [zone('outer', 0), zone('inner', 1, { zoneId: 'outer' }), leaf('m', 0, { zoneId: 'outer' })];
      expect(orderIds(items)).toEqual(['outer', 'm', 'inner']);
   });

   it('surfaces a dangling member (zone deleted) at root by its z', () => {
      const items = [leaf('a', 0), leaf('orphan', 5, { zoneId: 'gone' }), leaf('b', 1)];
      expect(orderIds(items)).toEqual(['a', 'b', 'orphan']);
   });
});

describe('buildBoardTree', () => {
   it('groups each zone with its members ascending, roots ascending', () => {
      const tree = buildBoardTree(toMap([leaf('top', 5), zone('Z', 1), leaf('m1', 0, { zoneId: 'Z' }), leaf('m2', 1, { zoneId: 'Z' }), leaf('bottom', 0)]));
      expect(tree.map((node) => node.item.id)).toEqual(['bottom', 'Z', 'top']);
      expect(tree.find((node) => node.item.id === 'Z')!.members.map((m) => m.id)).toEqual(['m1', 'm2']);
   });

   it('gives a non-zone root no members', () => {
      const tree = buildBoardTree(toMap([leaf('a', 0)]));
      expect(tree[0].members).toEqual([]);
   });

   it('flattens to the same order as flattenBoardOrder', () => {
      const map = toMap([leaf('t', 9), zone('Z', 2), leaf('m', 0, { zoneId: 'Z' }), leaf('b', 1)]);
      const flatFromTree = buildBoardTree(map).flatMap((node) => [node.item, ...node.members]).map((i) => i.id);
      expect(flatFromTree).toEqual(flattenBoardOrder(map).map((i) => i.id));
   });
});

describe('nextScopeZ', () => {
   it('is max(z)+1 among the root scope (zones and free items), members excluded', () => {
      const map = toMap([leaf('a', 0), zone('Z', 3), leaf('m', 40, { zoneId: 'Z' })]);
      expect(nextScopeZ(map, null)).toBe(4); // max(root: a=0, Z=3) + 1
   });

   it('is max(z)+1 among a zone\'s own members', () => {
      const map = toMap([zone('Z', 9), leaf('m1', 0, { zoneId: 'Z' }), leaf('m2', 1, { zoneId: 'Z' })]);
      expect(nextScopeZ(map, 'Z')).toBe(2); // max(m1=0, m2=1) + 1, not the zone's z
   });

   it('is 0 for an empty scope', () => {
      expect(nextScopeZ(toMap([leaf('a', 5)]), 'Z')).toBe(0);
   });

   it('ignores connections', () => {
      const map = toMap([leaf('a', 0), connection('c', 99)]);
      expect(nextScopeZ(map, null)).toBe(1);
   });
});

describe('repairBoardZ', () => {
   it('densifies the root scope to 0..k preserving relative order', () => {
      const { items, changed } = repairBoardZ(toMap([leaf('a', 10), leaf('b', 20), leaf('c', 30)]));
      expect([items['a'].z, items['b'].z, items['c'].z]).toEqual([0, 1, 2]);
      expect(changed).toHaveLength(3);
   });

   it('densifies each zone scope independently of the root scope', () => {
      const { items } = repairBoardZ(toMap([
         zone('Z', 7),
         leaf('free', 3),
         leaf('m1', 40, { zoneId: 'Z' }),
         leaf('m2', 90, { zoneId: 'Z' }),
      ]));
      // Root scope { free(3), Z(7) } -> free:0, Z:1. Zone scope { m1(40), m2(90) } -> m1:0, m2:1.
      expect(items['free'].z).toBe(0);
      expect(items['Z'].z).toBe(1);
      expect(items['m1'].z).toBe(0);
      expect(items['m2'].z).toBe(1);
   });

   it('is idempotent: an already-dense board reports no changes', () => {
      const first = repairBoardZ(toMap([zone('Z', 5), leaf('free', 1), leaf('m1', 3, { zoneId: 'Z' }), leaf('m2', 8, { zoneId: 'Z' })]));
      const second = repairBoardZ(first.items);
      expect(second.changed).toEqual([]);
      expect(second.items).toEqual(first.items);
   });

   it('leaves connection z untouched', () => {
      const { items } = repairBoardZ(toMap([leaf('a', 4), connection('c', 99), leaf('b', 8)]));
      expect(items['c'].z).toBe(99);
   });

   it('the repaired order round-trips through the flatten unchanged', () => {
      const source = toMap([leaf('top', 50), zone('Z', 20), leaf('m1', 5, { zoneId: 'Z' }), leaf('m2', 9, { zoneId: 'Z' }), leaf('bottom', 1)]);
      const before = flattenBoardOrder(source).map((item) => item.id);
      const after = flattenBoardOrder(repairBoardZ(source).items).map((item) => item.id);
      expect(after).toEqual(before);
   });
});
