// -- Repository Imports --
import { listAllBoardItems } from '@/lib/board/boardRepository';
import { listAllNotes } from '@/lib/notes/noteRepository';

// -- Local Imports --
import { boardPortalItemsToEdges, noteBodyToEdges } from './navigatorEdges';

// -- Type Imports --
import type { BoardItemLike } from './navigatorEdges';
import type { PortalEdge } from './navigatorGraph';

/*
 * The Navigator's ROOT set: the workspaces the crawl starts FROM. A root is itself a workspace entity
 * (board/note); its children are its outbound edges, resolved lazily like any deeper node. Two shapes:
 *  - current-workspace: a single root = the active tab's entity, whose FIRST-level edges are read LIVE off the
 *    in-memory board store / note body (zero Dexie, always fresh) - built by the panel from the active context.
 *  - app-wide: the multi-root forest of every portal-OWNING workspace, a sweep-class read that runs only on the
 *    scope flip (below). Both lean on the same `navigatorEdges` grammar, so a workspace counts as a root exactly
 *    when it would show at least one edge.
 */

/**
 * The app-wide forest roots: every working board that owns at least one portal, plus every working note whose
 * body carries at least one cotm:// link. Reads the whole `boardItems` + `notes` tables (a sweep, acceptable
 * on an opt-in scope flip); a workspace with no outbound edge is not a root. Board roots first, then notes.
 */
export async function resolveAppWideRootEdges(): Promise<PortalEdge[]> {
   const [boardItems, notes] = await Promise.all([listAllBoardItems(), listAllNotes()]);

   // Group every portal item under its owning board, so a board becomes a root exactly once.
   const portalsByBoard = new Map<string, BoardItemLike[]>();
   for (const record of boardItems) {
      if (record.kind !== 'portal') continue;
      const bucket = portalsByBoard.get(record.boardId);
      if (bucket) bucket.push(record);
      else portalsByBoard.set(record.boardId, [record]);
   }

   const roots: PortalEdge[] = [];
   for (const [boardId, items] of portalsByBoard) {
      // A board with only board-element portals maps to zero edges - not a root.
      if (boardPortalItemsToEdges(items).length > 0) roots.push({ target: { kind: 'entity', entity: 'board', id: boardId } });
   }
   for (const note of notes) {
      if (noteBodyToEdges(note.body).length > 0) roots.push({ target: { kind: 'entity', entity: 'note', id: note.id } });
   }
   return roots;
}
