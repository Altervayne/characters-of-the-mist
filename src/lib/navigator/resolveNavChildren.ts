// -- Repository Imports --
import { getBoard, listItems } from '@/lib/board/boardRepository';
import { getNote } from '@/lib/notes/noteRepository';
import { getBoardItemIdMap, getNoteItemIdMap, getItem } from '@/lib/drawer/drawerRepository';

// -- Local Imports --
import { collectNoteLinkHrefs } from '@/lib/notes/noteAssets';
import { parseLinkHref } from '@/lib/portals/linkTarget';
import { portalTargetToLinkTarget } from '@/lib/portals/portalTarget';

// -- Type Imports --
import type { PortalEdge } from './navigatorGraph';
import type { LinkTarget } from '@/lib/portals/linkTarget';
import type { Board, BoardItemContent, BoardItemKind, Note, PortalBoardContent } from '@/lib/types/board';

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

/** A common projection over the two board-item homes: enough to filter portals and read their content. */
type BoardItemLike = { kind: BoardItemKind; content: BoardItemContent };

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
      const items = await readBoardItems(target.id);
      const edges: PortalEdge[] = [];
      for (const item of items) {
         // The record's `kind` discriminant mirrors `content.kind`; a non-portal item (embed, card, note tile) is not an edge.
         if (item.kind !== 'portal') continue;
         const portal = item.content as PortalBoardContent;
         const edgeTarget = portalTargetToLinkTarget(portal.target);
         if (!edgeTarget) continue; // board-element -> null: omitted from the tree v1
         const label = portal.style.label || undefined;
         edges.push({ target: edgeTarget, label });
      }
      return edges;
   }

   if (target.entity === 'note') {
      const body = await readNoteBody(target.id);
      if (body === null) return [];
      const edges: PortalEdge[] = [];
      for (const href of collectNoteLinkHrefs(body)) {
         const edgeTarget = parseLinkHref(href);
         // Note edges are cotm:// links only: an entity (owns a tab) or a tabless element. External/section/unknown drop out.
         if (edgeTarget.kind === 'entity' || edgeTarget.kind === 'element') edges.push({ target: edgeTarget });
      }
      return edges;
   }

   // character: a leaf v1 (a character sheet carries no outbound link field yet).
   return [];
}
