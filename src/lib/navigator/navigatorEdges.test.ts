// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { boardPortalItemsToEdges, noteBodyToEdges } from './navigatorEdges';

// -- Type Imports --
import type { BoardItemLike } from './navigatorEdges';
import type { PortalTarget } from '@/lib/types/board';
import type { LinkTarget } from '@/lib/portals/linkTarget';

/*
 * The pure edge mappers - the one home for "what counts as a Navigator edge", shared by the resolver and the
 * roots seeder. A board yields its portal targets (label carried, board-element + non-portals dropped); a note
 * yields its cotm:// links only (external/section prose dropped).
 */

function portal(target: PortalTarget, label = ''): BoardItemLike {
   return { kind: 'portal', content: { kind: 'portal', target, style: { visual: null, label, align: 'bottom', background: true } } };
}

function kinds(targets: LinkTarget[]): string[] {
   return targets.map((target) => (target.kind === 'entity' ? `entity:${target.entity}` : target.kind));
}

describe('boardPortalItemsToEdges', () => {
   it('maps portal targets, carries the author label, and drops board-element + non-portal items', () => {
      // A non-portal item (its content is never read - the kind gate skips it first).
      const embed = { kind: 'note', content: { kind: 'note' } } as unknown as BoardItemLike;
      const edges = boardPortalItemsToEdges([
         portal({ kind: 'entity', entity: 'note', id: 'n' }, 'Read me'),
         portal({ kind: 'board-element', boardItemId: 'x' }),
         embed,
      ]);
      expect(kinds(edges.map((edge) => edge.target))).toEqual(['entity:note']);
      expect(edges[0].label).toBe('Read me');
   });

   it('leaves an empty author label off the edge (undefined, not "")', () => {
      const [edge] = boardPortalItemsToEdges([portal({ kind: 'entity', entity: 'board', id: 'b' })]);
      expect(edge.label).toBeUndefined();
   });
});

describe('noteBodyToEdges', () => {
   it('keeps cotm:// entity + element links and drops external/section prose', () => {
      const edges = noteBodyToEdges('[b](cotm://board/b) [x](https://out.test) [s](#heading) [e](cotm://item/de)');
      expect(kinds(edges.map((edge) => edge.target))).toEqual(['entity:board', 'element']);
   });
});
