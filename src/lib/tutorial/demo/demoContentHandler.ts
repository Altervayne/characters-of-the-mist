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

// -- Local Imports --
import { createDemoCharacter } from './demoCharacter';
import { createDemoBoard } from './demoBoard';
import { createDemoNote } from './demoNote';
import { createDemoPortalGraph } from './demoPortalGraph';
import { disposeDemoBoard, installDemoBoard } from './demoBoardBackend';
import { disposeDemoNote, installDemoNote } from './demoNoteBackend';
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
 *
 * All kinds share the tab wiring: seeding sets tab/active-pointer state through raw `setState`, never
 * `appendAndActivate*`/`persistWorkspace`, so it never touches `localStorage`. Teardown restores the
 * captured prior pointers, drops every demo instance (and its backend), AND re-asserts the exact prior
 * `localStorage` workspace bytes - so even a driven beat that DOES persist (a menu-park, a re-activate, or a
 * portal jump that opens a note tab, all of which call `persistWorkspace`) can never leave a demo tab behind.
 */

/** The kind of demo content a tutorial seeds; matches `TutorialDefinition.needsDemo`. */
export type DemoKind = 'character' | 'board' | 'note' | 'portal-graph';

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
 * Tears the demo down and returns the user to exactly where they were. Order matters: restore the tab
 * state FIRST (so React unmounts the demo sheet and its flush-on-unmount lands in the still-live demo
 * instance), re-point the registries at the prior tab, THEN drop every demo instance. Finally re-assert
 * the captured `localStorage` workspace verbatim, undoing any persist a driven beat triggered so no
 * demo tab can linger. Idempotent.
 */
export function teardownDemo(handle: DemoHandle): void {
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
