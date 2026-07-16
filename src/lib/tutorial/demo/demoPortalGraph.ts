// -- Other Library Imports --
import cuid from 'cuid';

// -- Factory Imports --
import { makePortalContent } from '@/lib/creation/portalContent';
import { buildLinkMarkdown } from '@/lib/portals/buildLinkToken';
import { EMBEDDED_POSTIT_SIZE } from '@/lib/board/embedDrawerItem';
import { PORTAL_BASE_SIZE } from '@/lib/board/portalSizing';
import { DEFAULT_BOARD_GRID } from '@/lib/board/boardRecords';

// -- Local Imports --
import { DEMO_PORTAL_BOARD_ID, DEMO_PORTAL_BOARD2_ID, DEMO_PORTAL_NOTE_ID } from './demoSentinels';

// -- Type Imports --
import type { Board, BoardItem, Note, PortalTarget } from '@/lib/types/board';

/*
 * The demo portal graph the Portals + Navigator tutorial (D5) crawls against: a board that portals to a note
 * that links on to a second board - the killer "a note points to a location" shape, crossing entity types.
 *
 *   The Sunken Vault  (board, entry) --portal--> Field Notes (note) --cotm:// link--> The Deeper Vault (board)
 *
 * Acyclic, one edge per node, so the tree reads at a glance and the crawl gate has real depth. Both edges are
 * built through the real factories so their grammar can't drift from a hand-written literal: the portal via
 * `makePortalContent` (its icon default, never an asset), the note link via `buildLinkMarkdown`. Every tile is
 * self-contained (no drawer/note/asset reference, no reference-mode embed), so nothing reaches a real store.
 * The entry board's portal sits near the opening view center so the fixture reads well. The assembled template
 * is deep-frozen and a fresh `structuredClone` is handed out per run, so a demo gesture mutates only the clone
 * and the next run starts clean.
 */

const ENTRY_BOARD_NAME = 'The Sunken Vault';
const LEAF_BOARD_NAME = 'The Deeper Vault';
const NOTE_TITLE = 'Field Notes';

/** Recursively freezes an object graph so the shared template cannot be mutated in place. */
function deepFreeze<T>(value: T): T {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value as Record<string, unknown>).forEach(deepFreeze);
      Object.freeze(value);
   }
   return value;
}

/** The bare board frame shared by both boards: origin camera, no drawer link, default grid, no drawings. */
function boardFrame(id: string, name: string, items: BoardItem[]): Board {
   return {
      id,
      name,
      viewport: { x: 0, y: 0, zoom: 1 },
      drawerItemId: null,
      grid: { ...DEFAULT_BOARD_GRID },
      nextLayerSeq: 1,
      items,
   };
}

function buildPortalGraph(): { entryBoard: Board; leafBoard: Board; note: Note } {
   // The entry board's one tile: a portal to the note, near view center so the opening frames it cleanly.
   const noteTarget: PortalTarget = { kind: 'entity', entity: 'note', id: DEMO_PORTAL_NOTE_ID };
   const portal: BoardItem = {
      id: cuid(),
      kind: 'portal',
      x: 320,
      y: 240,
      width: PORTAL_BASE_SIZE.width,
      height: PORTAL_BASE_SIZE.height,
      z: 0,
      content: makePortalContent(noteTarget, NOTE_TITLE),
   };
   const entryBoard = boardFrame(DEMO_PORTAL_BOARD_ID, ENTRY_BOARD_NAME, [portal]);

   // The note carries the second edge in its body: a cotm:// link on to the leaf board.
   const linkToLeaf = buildLinkMarkdown(LEAF_BOARD_NAME, { kind: 'entity', entity: 'board', id: DEMO_PORTAL_BOARD2_ID });
   const note: Note = {
      id: DEMO_PORTAL_NOTE_ID,
      title: NOTE_TITLE,
      body: `The tide-ledger points deeper still. Follow it down to ${linkToLeaf}.`,
   };

   // The leaf board: one flavour post-it, no outbound portal - the crawl bottoms out here.
   const flavour: BoardItem = {
      id: cuid(),
      kind: 'post-it',
      x: 240,
      y: 200,
      width: EMBEDDED_POSTIT_SIZE.width,
      height: EMBEDDED_POSTIT_SIZE.height,
      z: 0,
      content: { kind: 'post-it', mode: 'copy', data: { id: cuid(), text: 'Deeper than any tide should reach.' } },
   };
   const leafBoard = boardFrame(DEMO_PORTAL_BOARD2_ID, LEAF_BOARD_NAME, [flavour]);

   return { entryBoard, leafBoard, note };
}

/** The frozen template, built once. Never handed out directly - clone it. */
const DEMO_PORTAL_GRAPH_TEMPLATE = deepFreeze(buildPortalGraph());

/** A fresh, mutable demo portal graph for one tutorial run (a deep clone of the frozen template). */
export function createDemoPortalGraph(): { entryBoard: Board; leafBoard: Board; note: Note } {
   return structuredClone(DEMO_PORTAL_GRAPH_TEMPLATE);
}
