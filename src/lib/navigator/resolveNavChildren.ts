// -- Repository Imports --
import { getBoard, listItems } from '@/lib/board/boardRepository';
import { getNote } from '@/lib/notes/noteRepository';
import { getBoardItemIdMap, getNoteItemIdMap, getItem } from '@/lib/drawer/drawerRepository';

// -- Local Imports --
import { boardPortalItemsToEdges, noteBodyToEdges } from './navigatorEdges';

// -- Type Imports --
import type { BoardItemLike } from './navigatorEdges';
import type { PortalEdge } from './navigatorGraph';
import type { LinkTarget } from '@/lib/portals/linkTarget';
import type { Board, Note } from '@/lib/types/board';

/*
 * The Navigator's one genuinely-new reader: an entity's OUTBOUND edges, read live per expansion (no persisted
 * graph, no index - the same lean-on-live stance as the link-metadata cache). A board's edges are its
 * `kind:'portal'` items' targets; a note's are its body's markdown links. Every other target (character,
 * element, external, section) is a leaf - no outbound edges - so it resolves to `[]`.
 *
 * Dual-home per entity, mirroring `openEntityTab`'s working-row-then-drawer fallback: an OPEN (or
 * recently-open) entity lives in its working table; a saved-but-closed one lives only as its drawer snapshot.
 * Reading both means a portal crawls into a closed board/note just as well as an open one.
 */

/**
 * A board's items, dual-home: the working `boardItems` rows when a working board row exists (the source of
 * truth once opened, even if it has no items), else the durable `FULL_BOARD` drawer snapshot's `content.items`.
 * Returns `[]` when neither home has the board (a deleted target).
 */
async function readBoardItems(boardId: string): Promise<BoardItemLike[]> {
   // A present working row wins even when empty, so a freshly-emptied open board never falls back to a stale snapshot.
   if (await getBoard(boardId)) return listItems(boardId);

   const drawerItemId = (await getBoardItemIdMap()).get(boardId);
   const item = drawerItemId ? await getItem(drawerItemId) : undefined;
   if (item) return (item.content as Board).items;
   return [];
}

/**
 * A note's body, dual-home: the working `notes` row else the `NOTE` drawer snapshot (exactly
 * `resolveNoteAggregate`'s fallback). `null` when neither home has the note (a deleted target).
 */
async function readNoteBody(noteId: string): Promise<string | null> {
   const record = await getNote(noteId);
   if (record) return record.body;

   const drawerItemId = (await getNoteItemIdMap()).get(noteId);
   const item = drawerItemId ? await getItem(drawerItemId) : undefined;
   if (item) return (item.content as Note).body;
   return null;
}

/**
 * The outbound edges of a Navigator node's `target`. A board maps its portal items' `content.target` through
 * `portalTargetToLinkTarget`, skipping `board-element` (same-board spatial, `null` today); its portal author's
 * `style.label` rides along as the edge label. A note keeps only its body's `cotm://` links (entity/element) -
 * external note-body links are prose, not deliberate navigator edges, and drop out here. Everything non-
 * crawlable (character/element/external, and the never-an-edge section/unknown) resolves to `[]`.
 */
export async function resolveNavChildren(target: LinkTarget): Promise<PortalEdge[]> {
   if (target.kind !== 'entity') return [];

   if (target.entity === 'board') {
      return boardPortalItemsToEdges(await readBoardItems(target.id));
   }

   if (target.entity === 'note') {
      const body = await readNoteBody(target.id);
      return body === null ? [] : noteBodyToEdges(body);
   }

   // character: a leaf v1 (a character sheet carries no outbound link field yet).
   return [];
}
