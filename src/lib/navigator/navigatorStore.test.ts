// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import {
   clearNavigatorChildrenCache,
   loadNavChildren,
   NAV_TYPE_FILTER_KINDS,
   useNavigatorStore,
} from './navigatorStore';
import { buildChildNodes, buildRootNodes } from './navigatorGraph';

// -- Type Imports --
import type { PortalEdge } from './navigatorGraph';

/*
 * Tests for the Navigator's ephemeral store: the pure expand/collapse/scope/type-filter reducers, the lazy
 * node-map growth, and the module-level children cache + in-flight dedup. Also pins the invariant that the
 * store is NEVER serialized (no persist middleware, no localStorage write, no `journey` slice).
 */

/** A board-entity edge to id `id`. */
function board(id: string): PortalEdge {
   return { target: { kind: 'entity', entity: 'board', id } };
}

beforeEach(() => {
   useNavigatorStore.setState({
      rootScope: 'current-workspace',
      typeFilter: new Set(NAV_TYPE_FILTER_KINDS),
      expandedIds: new Set(),
      nodes: new Map(),
   });
   clearNavigatorChildrenCache();
});

describe('defaults', () => {
   it('starts scoped to the current workspace with every type on and an empty tree', () => {
      const state = useNavigatorStore.getState();
      expect(state.rootScope).toBe('current-workspace');
      expect(state.typeFilter).toEqual(new Set(['note', 'board', 'character', 'external']));
      expect(state.expandedIds.size).toBe(0);
      expect(state.nodes.size).toBe(0);
   });
});

describe('reducers', () => {
   it('setScope switches the root set and drops the materialized tree', () => {
      const { actions } = useNavigatorStore.getState();
      actions.setRoots(buildRootNodes([board('a')]));
      actions.expand('root:0', buildChildNodes(buildRootNodes([board('a')])[0], [board('b')]));
      expect(useNavigatorStore.getState().nodes.size).toBeGreaterThan(0);

      actions.setScope('app-wide');
      const state = useNavigatorStore.getState();
      expect(state.rootScope).toBe('app-wide');
      expect(state.nodes.size).toBe(0);
      expect(state.expandedIds.size).toBe(0);
   });

   it('toggleTypeFilter removes then re-adds a kind', () => {
      const { actions } = useNavigatorStore.getState();
      actions.toggleTypeFilter('board');
      expect(useNavigatorStore.getState().typeFilter.has('board')).toBe(false);
      actions.toggleTypeFilter('board');
      expect(useNavigatorStore.getState().typeFilter.has('board')).toBe(true);
   });

   it('setRoots seeds the forest and clears prior expansion', () => {
      const { actions } = useNavigatorStore.getState();
      actions.expand('stale', []);
      actions.setRoots(buildRootNodes([board('a'), board('b')]));
      const state = useNavigatorStore.getState();
      expect([...state.nodes.keys()]).toEqual(['root:0', 'root:1']);
      expect(state.expandedIds.size).toBe(0);
   });

   it('expand marks the node open and merges its children into the map', () => {
      const { actions } = useNavigatorStore.getState();
      const [root] = buildRootNodes([board('a')]);
      actions.setRoots([root]);
      const children = buildChildNodes(root, [board('b'), board('c')]);
      actions.expand(root.instanceId, children);

      const state = useNavigatorStore.getState();
      expect(state.expandedIds.has('root:0')).toBe(true);
      expect(state.nodes.has('root:0:0')).toBe(true);
      expect(state.nodes.has('root:0:1')).toBe(true);
      expect(state.nodes.size).toBe(3); // root + two children
   });

   it('collapse hides the node but keeps its cached children for an instant re-expand', () => {
      const { actions } = useNavigatorStore.getState();
      const [root] = buildRootNodes([board('a')]);
      actions.setRoots([root]);
      actions.expand(root.instanceId, buildChildNodes(root, [board('b')]));
      actions.collapse(root.instanceId);

      const state = useNavigatorStore.getState();
      expect(state.expandedIds.has('root:0')).toBe(false);
      expect(state.nodes.has('root:0:0')).toBe(true); // children retained
   });

   it('reset drops the whole tree', () => {
      const { actions } = useNavigatorStore.getState();
      actions.setRoots(buildRootNodes([board('a')]));
      actions.reset();
      const state = useNavigatorStore.getState();
      expect(state.nodes.size).toBe(0);
      expect(state.expandedIds.size).toBe(0);
   });

   it('mutations return fresh Set/Map instances (never in-place) for reactivity', () => {
      const { actions } = useNavigatorStore.getState();
      const before = useNavigatorStore.getState();
      actions.toggleTypeFilter('note');
      const after = useNavigatorStore.getState();
      expect(after.typeFilter).not.toBe(before.typeFilter);
   });
});

describe('module children cache + in-flight dedup', () => {
   it('shares one in-flight promise for a concurrent same-key load, then serves a cache hit', async () => {
      const target = { kind: 'element', drawerItemId: 'leaf' } as const; // a leaf resolves to [] without I/O

      const first = loadNavChildren(target);
      const second = loadNavChildren(target);
      expect(second).toBe(first); // deduped: no double-read

      const resolved = await first;
      const third = await loadNavChildren(target);
      expect(third).toBe(resolved); // cache hit returns the same array reference
   });
});

describe('never serialized (ephemeral, like the journey slice)', () => {
   it('has no persist middleware attached to the store', () => {
      expect((useNavigatorStore as unknown as { persist?: unknown }).persist).toBeUndefined();
   });

   it('exposes no rehydrate/setOptions persistence API on the store', () => {
      // A zustand `persist` store attaches a `.persist` control API; a plain ephemeral store has none.
      const store = useNavigatorStore as unknown as { persist?: { rehydrate?: unknown; setOptions?: unknown } };
      expect(store.persist).toBeUndefined();
   });

   it('has no journey slice on its state (dies on reload like the journey transient)', () => {
      expect('journey' in useNavigatorStore.getState()).toBe(false);
   });
});
