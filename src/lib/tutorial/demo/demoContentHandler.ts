// -- Store Imports --
import {
   disposeInstance,
   getOrCreateInstance,
   setActiveInstance,
} from '@/lib/character/characterStoreRegistry';
import { setActiveBoardInstance } from '@/lib/board/boardStoreRegistry';
import { setActiveNoteInstance } from '@/lib/notes/noteStoreRegistry';
import { restoreActivePointers, useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Local Imports --
import { createDemoCharacter } from './demoCharacter';
import { DEMO_CHARACTER_ID, isDemoId } from './demoSentinels';

// -- Type Imports --
import type { OpenTab } from '@/lib/character/tabManagerStore';

/*
 * The one seam that seeds and discards the tutorial engine's isolated demo content. The whole
 * zero-write guarantee rests here: a demo character is a registry instance we load a fixture into
 * and NEVER attach a persistence handle to (the only bridge to Dexie), so no edit - not even a
 * flush-on-unmount - can reach the store. Tab/active-pointer state is set through raw `setState`,
 * never `appendAndActivate*`/`persistWorkspace`, so the demo tab never touches `localStorage`
 * either. On teardown the captured prior pointers are restored and the demo instance is dropped;
 * nothing was persisted, so the real prior workspace still stands in `localStorage`.
 *
 * Scope: the CHARACTER demo only. Board + portal-graph demos land with their own tutorials.
 */

/** The kind of demo content a tutorial seeds; matches `TutorialDefinition.needsDemo`. */
export type DemoKind = 'character';

/** A live demo: the seeded sentinel id(s) plus the user's captured prior workspace, for exact restore. */
export interface DemoHandle {
   kind: DemoKind;
   /** The sentinel id(s) minted (one for the character demo). */
   ids: string[];
   /** The user's real workspace at seed time, restored verbatim on teardown. */
   prior: { openTabs: OpenTab[]; activeTabId: string | null };
}

/**
 * Seeds the demo content for `kind`, makes it the active surface, and returns a handle for teardown.
 * Async so a future board demo (async hydrate) folds in unchanged; the character demo resolves
 * synchronously. Idempotent-safe: prior state is captured from the user's real (non-demo) tabs, so a
 * re-seed can never mistake a live demo tab for prior state.
 */
export async function seedDemo(kind: DemoKind): Promise<DemoHandle> {
   const { openTabs, activeTabId } = useTabManagerStore.getState();
   const priorOpenTabs = openTabs.filter((tab) => !isDemoId(tab.id));
   const prior = {
      openTabs: priorOpenTabs,
      activeTabId: activeTabId !== null && isDemoId(activeTabId) ? null : activeTabId,
   };

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
      openTabs: [...priorOpenTabs, { id: DEMO_CHARACTER_ID, type: 'character' }],
      activeTabId: DEMO_CHARACTER_ID,
   });

   return { kind, ids: [DEMO_CHARACTER_ID], prior };
}

/**
 * Tears the demo down and returns the user to exactly where they were. Order matters: restore the tab
 * state FIRST (so React unmounts the demo sheet and its flush-on-unmount lands in the still-live demo
 * instance), re-point the registries at the prior tab, THEN drop the demo instance. Nothing was
 * persisted, so `localStorage` already holds the real prior workspace. Idempotent.
 */
export function teardownDemo(handle: DemoHandle): void {
   useTabManagerStore.setState({ openTabs: handle.prior.openTabs, activeTabId: handle.prior.activeTabId });

   const priorTab = handle.prior.openTabs.find((tab) => tab.id === handle.prior.activeTabId) ?? null;
   restoreActivePointers(priorTab);

   for (const id of handle.ids) disposeInstance(id);
}
