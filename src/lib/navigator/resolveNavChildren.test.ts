// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { importBoard } from '@/lib/board/boardRepository';
import { importNote } from '@/lib/notes/noteRepository';
import { createItem } from '@/lib/drawer/drawerRepository';
import { resolveNavChildren } from './resolveNavChildren';

// -- Type Imports --
import type { Board, BoardItem, Note, PortalTarget } from '@/lib/types/board';
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * Tests for the Navigator's outbound-edge reader against fake-indexeddb. It is dual-home per entity: a board's
 * portals resolve from the working `boardItems` rows AND from a saved-but-closed `FULL_BOARD` drawer snapshot;
 * a note's body links resolve from the working `notes` row AND from a `NOTE` drawer item. `board-element`
 * skips, note-body external links drop (cotm:// only), and non-portal embeds are excluded.
 */

beforeEach(async () => {
   await drawerDatabase.boards.clear();
   await drawerDatabase.boardItems.clear();
   await drawerDatabase.notes.clear();
   await drawerDatabase.items.clear();
});

/** A portal board item pointing at `target`, with an optional author label. */
function portalItem(id: string, target: PortalTarget, label = ''): BoardItem {
   return {
      id,
      kind: 'portal',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      z: 0,
      content: { kind: 'portal', target, style: { visual: null, label, align: 'bottom', background: true } },
   };
}

/** A board aggregate with the given items. */
function boardAggregate(id: string, items: BoardItem[]): Board {
   return { id, name: 'B', viewport: { x: 0, y: 0, zoom: 1 }, drawerItemId: null, grid: { type: 'dots' }, nextLayerSeq: 1, items };
}

/** The target kinds of a resolved edge list, for concise assertions. */
function targetKinds(targets: LinkTarget[]): string[] {
   return targets.map((target) => (target.kind === 'entity' ? `entity:${target.entity}` : target.kind));
}

describe('board node: dual-home portal resolution', () => {
   it('resolves every crawlable + leaf portal target from the working rows, skipping board-element and embeds', async () => {
      // A note-reference tile (kind 'note') proves a non-portal embed is not an edge.
      const noteEmbed: BoardItem = {
         id: 'embed-1',
         kind: 'note',
         x: 0,
         y: 0,
         width: 100,
         height: 100,
         z: 1,
         content: { kind: 'note', mode: 'reference', noteId: 'embedded-note' },
      };
      await importBoard(
         boardAggregate('bw', [
            portalItem('p-board', { kind: 'entity', entity: 'board', id: 'tb' }, 'Board portal'),
            portalItem('p-note', { kind: 'entity', entity: 'note', id: 'tn' }),
            portalItem('p-char', { kind: 'entity', entity: 'character', id: 'tc' }),
            portalItem('p-element', { kind: 'element', drawerItemId: 'te' }),
            portalItem('p-external', { kind: 'external', href: 'https://x.test' }),
            portalItem('p-board-element', { kind: 'board-element', boardItemId: 'some-item' }),
            noteEmbed,
         ]),
      );

      const edges = await resolveNavChildren({ kind: 'entity', entity: 'board', id: 'bw' });

      // board-element -> null (skipped), the embed excluded: five edges remain. Working rows come z-then-id
      // ordered (a display concern, not this reader's contract), so assert the SET of resolved kinds.
      expect(new Set(targetKinds(edges.map((edge) => edge.target)))).toEqual(
         new Set(['entity:board', 'entity:note', 'entity:character', 'element', 'external']),
      );
   });

   it('carries a portal author label onto the edge', async () => {
      await importBoard(boardAggregate('bl', [portalItem('p1', { kind: 'entity', entity: 'note', id: 'n' }, 'Read me')]));
      const [edge] = await resolveNavChildren({ kind: 'entity', entity: 'board', id: 'bl' });
      expect(edge.label).toBe('Read me');
   });

   it('resolves from a saved-but-closed FULL_BOARD drawer snapshot when no working row exists', async () => {
      await createItem({
         name: 'Closed board',
         game: 'NEUTRAL',
         type: 'FULL_BOARD',
         parentFolderId: null,
         content: boardAggregate('bd', [portalItem('p1', { kind: 'entity', entity: 'note', id: 'tn2' })]),
      });

      const edges = await resolveNavChildren({ kind: 'entity', entity: 'board', id: 'bd' });
      expect(edges).toHaveLength(1);
      expect(edges[0].target).toEqual({ kind: 'entity', entity: 'note', id: 'tn2' });
   });

   it('resolves to no edges for a board that exists in neither home', async () => {
      expect(await resolveNavChildren({ kind: 'entity', entity: 'board', id: 'ghost' })).toEqual([]);
   });
});

describe('note node: dual-home body-link resolution', () => {
   it('keeps cotm:// entity/element links and drops an external link, from a working row', async () => {
      await importNote({ id: 'nw', title: 'T', body: '[b](cotm://board/nb) and [ext](https://out.test) and [el](cotm://item/de)' }, null);

      const edges = await resolveNavChildren({ kind: 'entity', entity: 'note', id: 'nw' });
      expect(targetKinds(edges.map((edge) => edge.target))).toEqual(['entity:board', 'element']);
   });

   it('resolves from a NOTE drawer item when no working row exists', async () => {
      const note: Note = { id: 'nd', title: 'T', body: '[go](cotm://character/tc2)' };
      await createItem({ name: 'Closed note', game: 'NEUTRAL', type: 'NOTE', parentFolderId: null, content: note });

      const edges = await resolveNavChildren({ kind: 'entity', entity: 'note', id: 'nd' });
      expect(edges).toEqual([{ target: { kind: 'entity', entity: 'character', id: 'tc2' } }]);
   });

   it('resolves to no edges for a note that exists in neither home', async () => {
      expect(await resolveNavChildren({ kind: 'entity', entity: 'note', id: 'ghost' })).toEqual([]);
   });
});

describe('leaf nodes have no outbound edges', () => {
   it('resolves a character, element, and external target to []', async () => {
      expect(await resolveNavChildren({ kind: 'entity', entity: 'character', id: 'c' })).toEqual([]);
      expect(await resolveNavChildren({ kind: 'element', drawerItemId: 'd' })).toEqual([]);
      expect(await resolveNavChildren({ kind: 'external', href: 'https://x.test' })).toEqual([]);
   });
});
