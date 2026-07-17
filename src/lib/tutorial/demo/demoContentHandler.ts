// -- Store Imports --
import {
   disposeInstance,
   getOrCreateInstance,
   setActiveInstance,
} from '@/lib/character/characterStoreRegistry';
import { disposeBoardInstance, getOrCreateBoardInstance, setActiveBoardInstance } from '@/lib/board/boardStoreRegistry';
import { disposeNoteInstance, getOrCreateNoteInstance, setActiveNoteInstance } from '@/lib/notes/noteStoreRegistry';
import { restoreActivePointers, useTabManagerStore } from '@/lib/character/tabManagerStore';
import { WORKSPACE_KEY } from '@/lib/character/workspaceSession';
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { rebuildFolderTree, whenFolderTreeSettled } from '@/lib/drawer/drawerFolderTree';

// -- Local Imports --
import { createDemoCharacter } from './demoCharacter';
import { createDemoBoard } from './demoBoard';
import { createDemoNote } from './demoNote';
import { createDemoDrawer } from './demoDrawer';
import { createDemoPortalGraph } from './demoPortalGraph';
import { disposeDemoBoard, installDemoBoard } from './demoBoardBackend';
import { disposeDemoNote, installDemoNote } from './demoNoteBackend';
import { disposeDemoDrawer, installDemoDrawer } from './demoDrawerBackend';
import { createDrawerCommandEngine } from '@/lib/drawer/drawerCommandEngine';
import { DEMO_BOARD_ID, DEMO_CHARACTER_ID, DEMO_NOTE_ID, isDemoId } from './demoSentinels';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/*
 * The one seam that seeds and discards the tutorial engine's isolated demo content. The whole
 * zero-write guarantee rests here, and the two kinds get OPPOSITE seams because their stores have
 * opposite persistence architectures:
 *
 * - A demo CHARACTER is a registry instance we load a fixture into and NEVER attach a persistence
 *   handle to (the only bridge to Dexie), so no edit - not even a flush-on-unmount - can reach the store.
 * - A demo BOARD is persist-then-resync (commands write the repo, the view rebuilds from it), so a
 *   handle-less trick is not enough. Its fixture is hydrated into a per-id in-memory `boardRepository`
 *   backend keyed by the sentinel board id, so its commands do/undo in memory and persist to NOTHING.
 * - A demo NOTE takes the board's seam in miniature: its fixture lives in the per-id in-memory
 *   `noteRepository` backend keyed by the sentinel note id, so the note store's debounce-save lands in
 *   memory and reaches Dexie for nothing.
 * - The demo PORTAL GRAPH is a mixed graph: two demo boards (the board backend) plus a demo note (a sibling
 *   in-memory `noteRepository` backend), so the whole thing crawls and jumps entirely in memory.
 * - The demo DRAWER is the odd one out: the drawer is a global singleton tree, not a per-id entity, so it
 *   cannot be a sentinel-keyed backend. It is a whole-repository READ-ONLY overlay behind a module flag - the
 *   drawer's read functions route to an in-memory fixture while the flag is on. It is NOT a tab (the drawer is
 *   a panel over the current surface), so its seed leaves `openTabs`/`activeTabId` untouched; it only primes
 *   the folder-tree cache from the fixture and reloads the drawer view.
 *
 * All kinds share the tab wiring: seeding sets tab/active-pointer state through raw `setState`, never
 * `appendAndActivate*`/`persistWorkspace`, so it never touches `localStorage`. Teardown restores the
 * captured prior pointers, drops every demo instance (and its backend), AND re-asserts the exact prior
 * `localStorage` workspace bytes - so even a driven beat that DOES persist (a menu-park, a re-activate, or a
 * portal jump that opens a note tab, all of which call `persistWorkspace`) can never leave a demo tab behind.
 */

/** The kind of demo content a tutorial seeds; matches `TutorialDefinition.needsDemo`. */
export type DemoKind = 'character' | 'board' | 'note' | 'portal-graph' | 'drawer';

/** One seeded demo entity, tagged by kind so teardown drops the right backend + any store instance a jump created. */
type DemoEntity = { id: string; entity: 'character' | 'board' | 'note' };

/** A live demo: every seeded sentinel entity plus the user's captured prior workspace, for exact restore. */
export interface DemoHandle {
   kind: DemoKind;
   /** The sentinel entities seeded, each tagged for teardown disposal (a mixed graph carries several). */
   entities: DemoEntity[];
   /** The user's real workspace at seed time, restored verbatim on teardown. */
   prior: { openTabs: OpenTab[]; activeTabId: string | null };
   /** The serialized `localStorage` workspace at seed time (or `null` if absent), restored byte-for-byte. */
   priorWorkspaceRaw: string | null;
   /** The drawer's real current folder at seed time (`'drawer'` kind only), restored on teardown. */
   priorDrawerFolderId?: string | null;
}

/**
 * Seeds the demo content for `kind`, makes it the active surface, and returns a handle for teardown.
 * Async because the board demo hydrates asynchronously; the character demo resolves synchronously.
 * Idempotent-safe: prior state is captured from the user's real (non-demo) tabs, so a re-seed can never
 * mistake a live demo tab for prior state.
 */
export async function seedDemo(kind: DemoKind): Promise<DemoHandle> {
   const { openTabs, activeTabId } = useTabManagerStore.getState();
   const priorOpenTabs = openTabs.filter((tab) => !isDemoId(tab.id));
   const prior = {
      openTabs: priorOpenTabs,
      activeTabId: activeTabId !== null && isDemoId(activeTabId) ? null : activeTabId,
   };
   // Snapshot the serialized workspace so any persist a driven beat triggers is undone byte-for-byte.
   let priorWorkspaceRaw: string | null = null;
   try {
      priorWorkspaceRaw = localStorage.getItem(WORKSPACE_KEY);
   } catch {
      // localStorage unavailable (e.g. privacy mode): nothing was persisted to restore.
   }

   if (kind === 'board') return seedDemoBoard(prior, priorWorkspaceRaw);
   if (kind === 'note') return seedDemoNote(prior, priorWorkspaceRaw);
   if (kind === 'portal-graph') return seedDemoPortalGraph(prior, priorWorkspaceRaw);
   if (kind === 'drawer') return seedDemoDrawer(prior, priorWorkspaceRaw);
   return seedDemoCharacter(prior, priorWorkspaceRaw);
}

/** Prior workspace snapshot captured at seed, shared by both kinds' seeders. */
type PriorWorkspace = DemoHandle['prior'];

/** Seeds the demo CHARACTER: a fixture in a handle-less registry instance (its only route to Dexie unopened). */
function seedDemoCharacter(prior: PriorWorkspace, priorWorkspaceRaw: string | null): DemoHandle {
   // Load the fixture into a registry instance. Crucially NO attachPersistenceHandle: a handle-less
   // instance is inert (its only route to Dexie is the handle's save subscription), so demo edits
   // live purely in memory.
   const instance = getOrCreateInstance(DEMO_CHARACTER_ID);
   instance.getState().actions.loadCharacter(createDemoCharacter());

   // Point every registry at the demo (three-way park: character live, board/note cleared) and inject
   // the demo tab via raw setState - never persistWorkspace, so `localStorage` is untouched.
   setActiveInstance(DEMO_CHARACTER_ID);
   setActiveBoardInstance(null);
   setActiveNoteInstance(null);
   useTabManagerStore.setState({
      openTabs: [...prior.openTabs, { id: DEMO_CHARACTER_ID, type: 'character' }],
      activeTabId: DEMO_CHARACTER_ID,
   });

   return { kind: 'character', entities: [{ id: DEMO_CHARACTER_ID, entity: 'character' }], prior, priorWorkspaceRaw };
}

/** Seeds the demo BOARD: a fixture in the in-memory repository backend, hydrated into a real board instance. */
async function seedDemoBoard(prior: PriorWorkspace, priorWorkspaceRaw: string | null): Promise<DemoHandle> {
   // Load the fixture into the per-id in-memory backend, then hydrate the board instance FROM it - the
   // same load path a real board takes, only the repository reads/writes memory for this id, never Dexie.
   installDemoBoard(createDemoBoard());
   const instance = getOrCreateBoardInstance(DEMO_BOARD_ID);
   await instance.getState().actions.hydrate(DEMO_BOARD_ID);

   // Park every registry for a board tab (character on the menu fallback, board live, note cleared) and
   // inject the demo tab via raw setState - never persistWorkspace, so `localStorage` is untouched.
   restoreActivePointers({ id: DEMO_BOARD_ID, type: 'board' });
   useTabManagerStore.setState({
      openTabs: [...prior.openTabs, { id: DEMO_BOARD_ID, type: 'board' }],
      activeTabId: DEMO_BOARD_ID,
   });

   return { kind: 'board', entities: [{ id: DEMO_BOARD_ID, entity: 'board' }], prior, priorWorkspaceRaw };
}

/** Seeds the demo NOTE: a fixture in the in-memory note backend, hydrated into a real note instance. */
async function seedDemoNote(prior: PriorWorkspace, priorWorkspaceRaw: string | null): Promise<DemoHandle> {
   // Load the fixture into the per-id in-memory note backend, then hydrate the note instance FROM it - the
   // same load path a real note takes, only the repository reads/writes memory for this id, never Dexie.
   installDemoNote(createDemoNote());
   const instance = getOrCreateNoteInstance(DEMO_NOTE_ID);
   await instance.getState().actions.hydrate(DEMO_NOTE_ID);

   // Park every registry for a note tab (character/board cleared, note live) and inject the demo tab via raw
   // setState - never persistWorkspace, so `localStorage` is untouched.
   restoreActivePointers({ id: DEMO_NOTE_ID, type: 'note' });
   useTabManagerStore.setState({
      openTabs: [...prior.openTabs, { id: DEMO_NOTE_ID, type: 'note' }],
      activeTabId: DEMO_NOTE_ID,
   });

   return { kind: 'note', entities: [{ id: DEMO_NOTE_ID, entity: 'note' }], prior, priorWorkspaceRaw };
}

/** Seeds the demo PORTAL GRAPH: two boards + a note in their in-memory backends, the entry board hydrated live. */
async function seedDemoPortalGraph(prior: PriorWorkspace, priorWorkspaceRaw: string | null): Promise<DemoHandle> {
   // Load all three fixtures into their per-id in-memory backends, then hydrate ONLY the entry board instance -
   // the surface the tour opens on. The leaf board and the note hydrate lazily when a crawl or a jump reaches
   // them, each read routed to its backend, so the whole graph lives in memory and reaches Dexie for nothing.
   const { entryBoard, leafBoard, note } = createDemoPortalGraph();
   installDemoBoard(entryBoard);
   installDemoBoard(leafBoard);
   installDemoNote(note);

   const instance = getOrCreateBoardInstance(entryBoard.id);
   await instance.getState().actions.hydrate(entryBoard.id);

   // Park every registry for a board tab and inject the entry tab via raw setState - never persistWorkspace.
   restoreActivePointers({ id: entryBoard.id, type: 'board' });
   useTabManagerStore.setState({
      openTabs: [...prior.openTabs, { id: entryBoard.id, type: 'board' }],
      activeTabId: entryBoard.id,
   });

   return {
      kind: 'portal-graph',
      entities: [
         { id: entryBoard.id, entity: 'board' },
         { id: leafBoard.id, entity: 'board' },
         { id: note.id, entity: 'note' },
      ],
      prior,
      priorWorkspaceRaw,
   };
}

/**
 * Seeds the demo DRAWER: a routed overlay, not a tab. It opens the backend's session (installing the fixture)
 * and swaps in a fresh command engine, re-derives the folder-tree cache FROM that fixture - the routed
 * `getAllFolders` now reads the demo, so a rebuild fills the cache with demo folders - then loads the demo root
 * view. It never touches `openTabs`/`activeTabId`: the drawer is a panel over whatever surface is already active.
 *
 * The records and their history install in ONE call, because they are one fact: the session carries the demo's
 * engine beside its fixture, so there is no instant where the demo's rows are live while its edits would land
 * on the user's undo stack.
 *
 * Everything after that install is guarded, and this is the half that matters most: a caller only ever gets a
 * handle to tear down if this function RETURNS. A rebuild or a view load that threw would leave the session
 * live with nobody holding a handle to it - routing on, forever, sending the user's next real save into a
 * fixture nobody is reading. So a failed seed drops the session on its way out and re-raises: either a demo is
 * live and its handle exists, or there is no demo at all.
 *
 * Settle discipline: a rebuild started before the swap could settle AFTER it and paint the wrong drawer into the
 * cache, so drain any in-flight rebuild first, then await the demo rebuild before loading the view.
 */
async function seedDemoDrawer(prior: PriorWorkspace, priorWorkspaceRaw: string | null): Promise<DemoHandle> {
   const priorDrawerFolderId = useDrawerStore.getState().currentFolderId;

   // Drain any in-flight (real-reading) rebuild so it can't settle after the swap and clobber the demo cache.
   await whenFolderTreeSettled();
   installDemoDrawer(createDemoDrawer(), createDrawerCommandEngine());
   try {
      // Re-derive the cache from the demo backend, then load the demo library at root.
      await rebuildFolderTree();
      await useDrawerStore.getState().actions.setDrawerCurrentFolderId(null);
   } catch (error) {
      disposeDemoDrawer();
      throw error;
   }

   return { kind: 'drawer', entities: [], prior, priorWorkspaceRaw, priorDrawerFolderId };
}

/**
 * Tears the demo drawer down: the mirror of {@link seedDemoDrawer}. It closes the session - dropping the fixture
 * and its history in one act - re-derives the folder-tree cache from the REAL repository, and restores the
 * drawer to its prior folder. Nothing reached Dexie, so there is no per-entity disposal: dropping the session IS
 * the guarantee.
 *
 * The disposal sits in a `finally` around everything that can throw, and runs BEFORE the work that needs the
 * real drawer back. That ordering is the guarantee, not tidiness: routing that survived a failed teardown would
 * send the user's next real save into a fixture nobody is reading, which is the one failure mode this design
 * exists to rule out. A rebuild or a view load may fail; the drawer still comes home.
 *
 * The same settle discipline applies: drain the in-flight (demo-reading) rebuild before the swap back so a
 * stale reload can't repaint demo rows into the real view.
 */
async function teardownDemoDrawer(handle: DemoHandle): Promise<void> {
   try {
      await whenFolderTreeSettled();
   } finally {
      disposeDemoDrawer();
   }
   await rebuildFolderTree();
   await useDrawerStore.getState().actions.setDrawerCurrentFolderId(handle.priorDrawerFolderId ?? null);

   // Belt-and-suspenders: re-assert the exact prior workspace bytes. The read-only overlay never persists, but
   // this keeps every teardown path identical.
   try {
      if (handle.priorWorkspaceRaw === null) localStorage.removeItem(WORKSPACE_KEY);
      else localStorage.setItem(WORKSPACE_KEY, handle.priorWorkspaceRaw);
   } catch {
      // localStorage unavailable: nothing was persisted, nothing to restore.
   }
}

/**
 * Tears the demo down and returns the user to exactly where they were. The drawer overlay is its own path (no
 * tabs, no instances - a flag flip plus a cache re-derive). For the tab-backed kinds, order matters: restore
 * the tab state FIRST (so React unmounts the demo sheet and its flush-on-unmount lands in the still-live demo
 * instance), re-point the registries at the prior tab, THEN drop every demo instance. Finally re-assert
 * the captured `localStorage` workspace verbatim, undoing any persist a driven beat triggered so no
 * demo tab can linger. Idempotent.
 */
export async function teardownDemo(handle: DemoHandle): Promise<void> {
   if (handle.kind === 'drawer') {
      await teardownDemoDrawer(handle);
      return;
   }

   useTabManagerStore.setState({ openTabs: handle.prior.openTabs, activeTabId: handle.prior.activeTabId });

   const priorTab = handle.prior.openTabs.find((tab) => tab.id === handle.prior.activeTabId) ?? null;
   restoreActivePointers(priorTab);

   for (const { id, entity } of handle.entities) {
      // Drop the store instance THEN its in-memory backing (a board/note demo dives may have created a store
      // instance the seed did not); a late write for the sentinel id can no longer reach the backend but also
      // can never fall through to Dexie (routed by the sentinel prefix). Every dispose is idempotent, so an
      // instance a jump never created is a harmless no-op.
      if (entity === 'board') {
         disposeBoardInstance(id);
         disposeDemoBoard(id);
      } else if (entity === 'note') {
         disposeNoteInstance(id);
         disposeDemoNote(id);
      } else {
         disposeInstance(id);
      }
   }

   try {
      if (handle.priorWorkspaceRaw === null) localStorage.removeItem(WORKSPACE_KEY);
      else localStorage.setItem(WORKSPACE_KEY, handle.priorWorkspaceRaw);
   } catch {
      // localStorage unavailable: nothing was persisted, nothing to restore.
   }
}
