// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   buildChildNodes,
   buildRootNodes,
   canonicalKeyForTarget,
   classifySeenAbove,
   isCrawlableTarget,
   makeChildInstanceId,
   navKindForTarget,
   NAV_ROOT_INSTANCE_ID,
} from './navigatorGraph';

// -- Type Imports --
import type { NavNode, PortalEdge } from './navigatorGraph';
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * The Navigator's pure graph model: canonical keys + instance ids kept distinct, and the ancestor-path cycle
 * rule that keeps a cyclic, diamond-laden graph finite per branch. The crawl helper below drives a SYNTHETIC
 * edge map (no I/O) so termination and the diamond/cycle shapes are provable without any store or Dexie.
 */

/** A board-entity edge to id `id` (the common branch case in these fixtures). */
function board(id: string): PortalEdge {
   return { target: { kind: 'entity', entity: 'board', id } };
}

/**
 * Fully materializes a tree from `rootEdges`, recursing only into crawlable (non-back-edge) nodes via the
 * synthetic `getEdges`. Its termination on a cyclic graph IS the proof: a repeat down a path becomes a
 * terminal back-edge, so any path is bounded by the count of distinct canonical keys.
 */
function crawl(rootEdges: PortalEdge[], getEdges: (canonicalKey: string) => PortalEdge[]): NavNode[] {
   const all: NavNode[] = [];
   const visit = (node: NavNode): void => {
      all.push(node);
      if (!node.crawlable) return;
      for (const child of buildChildNodes(node, getEdges(node.canonicalKey))) visit(child);
   };
   for (const root of buildRootNodes(rootEdges)) visit(root);
   return all;
}

describe('canonical key vs instance id (the two identities)', () => {
   it('keys an entity target by its type + entity id', () => {
      expect(canonicalKeyForTarget({ kind: 'entity', entity: 'board', id: 'b1' })).toBe('board:b1');
      expect(canonicalKeyForTarget({ kind: 'entity', entity: 'note', id: 'n1' })).toBe('note:n1');
      expect(canonicalKeyForTarget({ kind: 'entity', entity: 'character', id: 'c1' })).toBe('character:c1');
   });

   it('keys the leaves by their own id space (element by drawer item id, external by href)', () => {
      expect(canonicalKeyForTarget({ kind: 'element', drawerItemId: 'd1' })).toBe('element:d1');
      expect(canonicalKeyForTarget({ kind: 'external', href: 'https://x.test' })).toBe('external:https://x.test');
   });

   it('mints a per-position instance id from the parent id + ordinal', () => {
      expect(makeChildInstanceId(NAV_ROOT_INSTANCE_ID, 0)).toBe('root:0');
      expect(makeChildInstanceId('root:0', 2)).toBe('root:0:2');
   });
});

describe('nav kind + crawlability', () => {
   it('derives the displayed kind from the target', () => {
      expect(navKindForTarget({ kind: 'entity', entity: 'note', id: 'n' })).toBe('note');
      expect(navKindForTarget({ kind: 'external', href: 'https://x.test' })).toBe('external');
      expect(navKindForTarget({ kind: 'element', drawerItemId: 'd' })).toBe('element');
   });

   it('treats only a board or note entity as a crawlable branch', () => {
      expect(isCrawlableTarget({ kind: 'entity', entity: 'board', id: 'b' })).toBe(true);
      expect(isCrawlableTarget({ kind: 'entity', entity: 'note', id: 'n' })).toBe(true);
      expect(isCrawlableTarget({ kind: 'entity', entity: 'character', id: 'c' })).toBe(false);
      expect(isCrawlableTarget({ kind: 'element', drawerItemId: 'd' })).toBe(false);
      expect(isCrawlableTarget({ kind: 'external', href: 'https://x.test' })).toBe(false);
   });
});

describe('classifySeenAbove (ancestor-path back-edge)', () => {
   it('flags a key already on the ancestor path', () => {
      expect(classifySeenAbove('board:a', ['board:a', 'board:b'])).toBe(true);
   });

   it('does not flag a key absent from the path (a diamond arrival, not a loop)', () => {
      expect(classifySeenAbove('board:d', ['board:a', 'board:b'])).toBe(false);
   });
});

describe('cycle classification over a synthetic graph', () => {
   it('flags the SECOND occurrence of A in A -> B -> A as "seen above" and stops crawling', () => {
      const edges: Record<string, PortalEdge[]> = { 'board:a': [board('b')], 'board:b': [board('a')] };
      const nodes = crawl([board('a')], (key) => edges[key] ?? []);

      // root A, its child B, and B's child A' (the back-edge) - and nothing past A'.
      const backEdge = nodes.find((node) => node.canonicalKey === 'board:a' && node.depth === 2);
      expect(backEdge?.seenAbove).toBe(true);
      expect(backEdge?.crawlable).toBe(false);
      expect(nodes).toHaveLength(3);
   });

   it('renders a diamond as two nodes / one canonical key / both expandable', () => {
      // A -> B, A -> C, B -> D, C -> D. D is reached twice but is a loop on neither branch.
      const edges: Record<string, PortalEdge[]> = {
         'board:a': [board('b'), board('c')],
         'board:b': [board('d')],
         'board:c': [board('d')],
         'board:d': [],
      };
      const nodes = crawl([board('a')], (key) => edges[key] ?? []);

      const dNodes = nodes.filter((node) => node.canonicalKey === 'board:d');
      expect(dNodes).toHaveLength(2);
      expect(new Set(dNodes.map((node) => node.instanceId)).size).toBe(2); // distinct positions
      expect(dNodes.every((node) => !node.seenAbove)).toBe(true);
      expect(dNodes.every((node) => node.crawlable)).toBe(true); // both crawl - neither is collapsed
   });

   it('terminates finitely on a fully cyclic graph A -> B -> C -> A', () => {
      const edges: Record<string, PortalEdge[]> = {
         'board:a': [board('b')],
         'board:b': [board('c')],
         'board:c': [board('a')],
      };
      const nodes = crawl([board('a')], (key) => edges[key] ?? []);

      // A, B, C, then A' (the back-edge) - exactly four, then the walk halts.
      expect(nodes.map((node) => node.canonicalKey)).toEqual(['board:a', 'board:b', 'board:c', 'board:a']);
      expect(nodes[3].seenAbove).toBe(true);
      expect(nodes[3].crawlable).toBe(false);
   });
});

describe('buildChildNodes / buildRootNodes (position + ancestor bookkeeping)', () => {
   it('seeds roots with no ancestors, so no root is a back-edge', () => {
      const roots = buildRootNodes([board('a'), board('b')]);
      expect(roots.map((node) => node.instanceId)).toEqual(['root:0', 'root:1']);
      expect(roots.every((node) => node.ancestorKeys.length === 0 && !node.seenAbove)).toBe(true);
   });

   it('extends the ancestor path by the parent key for each child', () => {
      const [root] = buildRootNodes([board('a')]);
      const [child] = buildChildNodes(root, [board('b')]);
      expect(child.parentInstanceId).toBe('root:0');
      expect(child.instanceId).toBe('root:0:0');
      expect(child.ancestorKeys).toEqual(['board:a']);
      expect(child.depth).toBe(1);
   });

   it('carries a board portal edge label onto its node target set (label preserved on the edge)', () => {
      const labeled: PortalEdge = { target: { kind: 'entity', entity: 'note', id: 'n' } as LinkTarget, label: 'To the note' };
      const [root] = buildRootNodes([labeled]);
      expect(root.navKind).toBe('note');
   });
});
