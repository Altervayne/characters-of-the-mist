// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { importBoard } from '@/lib/board/boardRepository';
import { importNote } from '@/lib/notes/noteRepository';
import { resolveAppWideRootEdges } from './navigatorRoots';

// -- Type Imports --
import type { Board, BoardItem, PortalTarget } from '@/lib/types/board';
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * The app-wide forest roots: every working board that owns a portal, plus every working note whose body
 * carries a cotm:// link. A workspace with no outbound edge (or only a board-element portal) is not a root.
 */

beforeEach(async () => {
   await drawerDatabase.boards.clear();
   await drawerDatabase.boardItems.clear();
   await drawerDatabase.notes.clear();
});

function portalItem(id: string, target: PortalTarget): BoardItem {
   return {
      id,
      kind: 'portal',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      z: 0,
      content: { kind: 'portal', target, style: { visual: null, label: '', align: 'bottom', background: true } },
   };
}

function boardAggregate(id: string, items: BoardItem[]): Board {
   return { id, name: 'B', viewport: { x: 0, y: 0, zoom: 1 }, drawerItemId: null, grid: { type: 'dots' }, nextLayerSeq: 1, items };
}

/** The canonical keys of a root-edge set, order-independent. */
function keys(edges: { target: LinkTarget }[]): Set<string> {
   return new Set(edges.map((edge) => (edge.target.kind === 'entity' ? `${edge.target.entity}:${edge.target.id}` : edge.target.kind)));
}

describe('resolveAppWideRootEdges', () => {
   it('roots every portal-owning board and every linking note, once each', async () => {
      await importBoard(boardAggregate('b1', [portalItem('p1', { kind: 'entity', entity: 'note', id: 'tn' }), portalItem('p2', { kind: 'external', href: 'https://x.test' })]));
      await importNote({ id: 'n1', title: 'T', body: '[go](cotm://board/tb)' }, null);

      const edges = await resolveAppWideRootEdges();
      // b1 appears ONCE despite two portals; n1 is a root; both entity roots.
      expect(keys(edges)).toEqual(new Set(['board:b1', 'note:n1']));
   });

   it('excludes an edgeless board (only a board-element portal) and a link-free note', async () => {
      await importBoard(boardAggregate('b2', [portalItem('pe', { kind: 'board-element', boardItemId: 'x' })]));
      await importNote({ id: 'n2', title: 'T', body: 'plain prose, no links' }, null);

      expect(await resolveAppWideRootEdges()).toEqual([]);
   });

   it('is empty when nothing links anywhere (first-run)', async () => {
      expect(await resolveAppWideRootEdges()).toEqual([]);
   });
});
