// -- Library Imports --
import { create } from 'zustand';

// -- Engine Imports --
import { drawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';

// -- Local Imports --
import { canonicalKeyForTarget } from './navigatorGraph';
import { resolveNavChildren } from './resolveNavChildren';

// -- Type Imports --
import type { NavNode, PortalEdge } from './navigatorGraph';
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * The Navigator's ephemeral tree state: a single app-wide store (the tree is app-wide, not per-context),
 * deliberately NEVER serialized - it dies on reload like the `journey` slice and other transient view state.
 * It lives ABOVE the tab-switch boundary so the first jump (which switches the active tab and unmounts the
 * previously-active surface) cannot unmount the tree mid-crawl. The ONLY persisted Navigator state is
 * `appSettings.navigatorOpen` (the panel's open/closed), not this.
 *
 * The tree grows lazily: roots materialize, then each deeper level materializes only when the user expands a
 * node's caret. `nodes` holds the materialized positions keyed by instance id; `expandedIds` is which of them
 * are open. The children cache + in-flight map live at MODULE level (below), not in reactive state, so a
 * StrictMode double-mount neither resets them nor double-reads - copied from the link-metadata cache pattern.
 */

/** The root set the tree crawls from: just the current workspace, or the whole app's portal-owning forest. */
export type NavRootScope = 'current-workspace' | 'app-wide';

/** The target kinds the type filter toggles (display-only; a filtered node stays traversable). */
export type NavTypeFilterKind = 'note' | 'board' | 'character' | 'external';

/** Every filter kind - the default all-on set. */
export const NAV_TYPE_FILTER_KINDS: readonly NavTypeFilterKind[] = ['note', 'board', 'character', 'external'];

interface NavigatorState {
   /** The root set (default current-workspace). Changing it drops the materialized tree (a new forest). */
   rootScope: NavRootScope;
   /** Displayed target kinds (default all-on). */
   typeFilter: Set<NavTypeFilterKind>;
   /** Which instance ids are expanded (path-based instance id). */
   expandedIds: Set<string>;
   /** The materialized tree nodes, keyed by instance id, grown lazily on each expand. */
   nodes: Map<string, NavNode>;
   actions: {
      /** Switches the root set and drops the current tree (its roots no longer apply). */
      setScope: (scope: NavRootScope) => void;
      /** Toggles a target kind in the display filter. */
      toggleTypeFilter: (kind: NavTypeFilterKind) => void;
      /** Seeds the forest roots, replacing any prior tree (on open, scope flip, or refresh). */
      setRoots: (roots: NavNode[]) => void;
      /** Marks a node expanded and merges its resolved children into the node map. */
      expand: (instanceId: string, children: NavNode[]) => void;
      /** Collapses a node (hides its subtree; the cached nodes stay for an instant re-expand). */
      collapse: (instanceId: string) => void;
      /** Marks a crawlable node that resolved to zero edges as childless, so it drops its dead-end caret. */
      markChildless: (instanceId: string) => void;
      /** Drops the whole tree (roots, nodes, expansion) - a hard reset for re-seeding. */
      reset: () => void;
   };
}

/** Seeds a fresh node map from a root list. */
function rootsToNodeMap(roots: NavNode[]): Map<string, NavNode> {
   return new Map(roots.map((root) => [root.instanceId, root]));
}

export const useNavigatorStore = create<NavigatorState>((set) => ({
   rootScope: 'current-workspace',
   typeFilter: new Set(NAV_TYPE_FILTER_KINDS),
   expandedIds: new Set(),
   nodes: new Map(),
   actions: {
      // A scope change is a new forest: drop the materialized tree so no cross-scope node lingers.
      setScope: (scope) => set({ rootScope: scope, nodes: new Map(), expandedIds: new Set() }),
      toggleTypeFilter: (kind) =>
         set((state) => {
            const typeFilter = new Set(state.typeFilter);
            if (typeFilter.has(kind)) typeFilter.delete(kind);
            else typeFilter.add(kind);
            return { typeFilter };
         }),
      setRoots: (roots) => set({ nodes: rootsToNodeMap(roots), expandedIds: new Set() }),
      expand: (instanceId, children) =>
         set((state) => {
            const nodes = new Map(state.nodes);
            for (const child of children) nodes.set(child.instanceId, child);
            const expandedIds = new Set(state.expandedIds).add(instanceId);
            return { nodes, expandedIds };
         }),
      collapse: (instanceId) =>
         set((state) => {
            const expandedIds = new Set(state.expandedIds);
            expandedIds.delete(instanceId);
            return { expandedIds };
         }),
      // A branch that resolved to no outbound portals is really a leaf: flag it so the row drops its caret
      // (the flag dies with the node on any re-seed, so a workspace switch never carries a stale mark).
      markChildless: (instanceId) =>
         set((state) => {
            const node = state.nodes.get(instanceId);
            if (!node || node.childless) return {};
            const nodes = new Map(state.nodes);
            nodes.set(instanceId, { ...node, childless: true });
            return { nodes };
         }),
      reset: () => set({ nodes: new Map(), expandedIds: new Set() }),
   },
}));

export const useNavigatorActions = () => useNavigatorStore((state) => state.actions);

// ==================
//  Module-level children cache (NOT reactive state) - copied from the link-metadata cache pattern
// ==================

/** Memoized outbound edges per canonical key, for the session (re-resolved on a fresh expand / manual refresh). */
const childrenCache = new Map<string, PortalEdge[]>();
/** One shared in-flight promise per canonical key, so a StrictMode double-fire never double-reads. */
const inFlight = new Map<string, Promise<PortalEdge[]>>();
let invalidationWired = false;

/**
 * Wires a one-time invalidation: any drawer command clears the children cache, so a renamed/deleted/moved
 * target re-resolves on its next expand (the drawer/saved layer, exactly as the link-metadata cache does).
 * Live per-board edits are NOT covered here - a browse panel accepts that staleness behind a manual refresh -
 * so this only tracks the drawer command engine. Wired lazily on first load so a bare import stays side-
 * effect-free.
 */
function wireInvalidation(): void {
   if (invalidationWired) return;
   invalidationWired = true;
   drawerCommandEngine.subscribe(() => {
      if (childrenCache.size === 0) return;
      childrenCache.clear();
   });
}

/**
 * Resolves a target's outbound edges through the session cache: a cache hit returns immediately, a concurrent
 * request for the same canonical key shares one in-flight promise, and a miss reads live via
 * {@link resolveNavChildren} and caches the result. The cache/dedup keys on the ENTITY canonical key, so two
 * tree positions that reach the same target read it once.
 */
export function loadNavChildren(target: LinkTarget): Promise<PortalEdge[]> {
   const key = canonicalKeyForTarget(target);
   const cached = childrenCache.get(key);
   if (cached) return Promise.resolve(cached);
   const existing = inFlight.get(key);
   if (existing) return existing;
   wireInvalidation();
   const load = resolveNavChildren(target).then((edges) => {
      childrenCache.set(key, edges);
      inFlight.delete(key);
      return edges;
   });
   inFlight.set(key, load);
   return load;
}

/** Clears the module children cache + in-flight map (the manual "refresh" escape hatch, and test isolation). */
export function clearNavigatorChildrenCache(): void {
   childrenCache.clear();
   inFlight.clear();
}
