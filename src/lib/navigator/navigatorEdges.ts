// -- Local Imports --
import { collectNoteLinkHrefs } from '@/lib/notes/noteAssets';
import { parseLinkHref } from '@/lib/portals/linkTarget';
import { portalTargetToLinkTarget } from '@/lib/portals/portalTarget';

// -- Type Imports --
import type { PortalEdge } from './navigatorGraph';
import type { BoardItemContent, BoardItemKind, PortalBoardContent } from '@/lib/types/board';

/*
 * The pure edge mappers: a board's items -> its portal edges, and a note's body -> its cotm:// edges. Kept
 * home-agnostic (they take already-read items/body, never touch Dexie or a store) so BOTH edge readers share
 * one grammar: `resolveNavChildren` feeds them the dual-home Dexie read, the roots seeder feeds them the live
 * in-memory board store / note body. One place owns "what counts as a Navigator edge", so the two readers can
 * never drift.
 */

/** A board item projected to just what an edge needs: its kind discriminant and inline content. */
export type BoardItemLike = { kind: BoardItemKind; content: BoardItemContent };

/**
 * A board's outbound edges: its `kind:'portal'` items' targets, mapped through `portalTargetToLinkTarget`
 * (skipping `board-element`, which is `null` today), with each portal author's `style.label` riding along as
 * the edge label. A non-portal item (embed, card, note tile) is not an edge.
 */
export function boardPortalItemsToEdges(items: readonly BoardItemLike[]): PortalEdge[] {
   const edges: PortalEdge[] = [];
   for (const item of items) {
      if (item.kind !== 'portal') continue;
      const portal = item.content as PortalBoardContent;
      const edgeTarget = portalTargetToLinkTarget(portal.target);
      if (!edgeTarget) continue; // board-element -> null: omitted from the tree v1
      const label = portal.style.label || undefined;
      edges.push({ target: edgeTarget, label });
   }
   return edges;
}

/**
 * A note's outbound edges: its body's `cotm://` links only - an entity (owns a tab) or a tabless element.
 * External/section/unknown links are prose, not deliberate navigator edges, and drop out here.
 */
export function noteBodyToEdges(body: string): PortalEdge[] {
   const edges: PortalEdge[] = [];
   for (const href of collectNoteLinkHrefs(body)) {
      const edgeTarget = parseLinkHref(href);
      if (edgeTarget.kind === 'entity' || edgeTarget.kind === 'element') edges.push({ target: edgeTarget });
   }
   return edges;
}
