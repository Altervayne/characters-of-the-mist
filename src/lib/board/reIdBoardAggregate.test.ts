// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { reIdBoardAggregate } from './reIdBoardAggregate';

// -- Type Imports --
import type { Board } from '@/lib/types/board';

/*
 * Tests for the connection-safe board re-ID used on file import. The crucial property:
 * item ids change, but a connection's endpoints still resolve to their (re-IDed) items -
 * which a generic `deepReId` would break.
 */

function makeBoard(): Board {
   return {
      id: 'board-old',
      name: 'Imported',
      viewport: { x: 5, y: 6, zoom: 2 },
      drawerItemId: 'drawer-old',
      items: [
         { id: 'a', kind: 'post-it', x: 0, y: 0, width: 100, height: 100, z: 0, zoneId: 'zone', content: { kind: 'post-it', text: 'a' } },
         { id: 'b', kind: 'post-it', x: 10, y: 10, width: 100, height: 100, z: 1, zoneId: 'ghost', content: { kind: 'post-it', text: 'b' } },
         { id: 'conn', kind: 'connection', x: 0, y: 0, width: 0, height: 0, z: 2, content: { kind: 'connection', from: 'a', to: 'b', style: { width: 2, color: '#f00' } } },
         { id: 'ref', kind: 'card', x: 20, y: 20, width: 100, height: 100, z: 3, content: { kind: 'card', mode: 'reference', sourceDrawerItemId: 'src-1' } },
         { id: 'char', kind: 'character', x: 30, y: 30, width: 280, height: 132, z: 5, content: { kind: 'character', sourceDrawerItemId: 'char-src', characterId: 'char-instance' } },
         { id: 'zone', kind: 'zone', x: -50, y: -50, width: 400, height: 400, z: 4, content: { kind: 'zone', collapsed: false } },
      ],
   };
}

describe('reIdBoardAggregate', () => {
   it('mints a fresh board id and item ids', () => {
      const board = makeBoard();
      const result = reIdBoardAggregate(board);

      expect(result.id).not.toBe('board-old');
      const ids = result.items.map((i) => i.id);
      expect(ids).not.toContain('a');
      expect(ids).not.toContain('b');
      expect(new Set(ids).size).toBe(ids.length); // all unique
   });

   it('keeps connection endpoints resolving to the re-IDed items', () => {
      const board = makeBoard();
      const result = reIdBoardAggregate(board);

      const itemIds = new Set(result.items.filter((i) => i.kind !== 'connection').map((i) => i.id));
      const connection = result.items.find((i) => i.content.kind === 'connection');
      expect(connection!.content).toMatchObject({ kind: 'connection' });
      const { from, to } = connection!.content as { from: string; to: string };
      // Both endpoints now name real (re-IDed) items, not the stale 'a'/'b'.
      expect(itemIds.has(from)).toBe(true);
      expect(itemIds.has(to)).toBe(true);
      expect(from).not.toBe('a');
      expect(to).not.toBe('b');
   });

   it('remaps a member\'s zoneId to the re-IDed zone (and clears a link to a zone outside the set)', () => {
      const board = makeBoard();
      const result = reIdBoardAggregate(board);

      const zone = result.items.find((i) => i.kind === 'zone')!;
      const memberA = result.items.find((i) => i.content.kind === 'post-it' && i.content.text === 'a')!;
      const memberB = result.items.find((i) => i.content.kind === 'post-it' && i.content.text === 'b')!;
      // 'a' followed its zone to the new id; 'b' pointed at a zone not in the set, so it cleared.
      expect(memberA.zoneId).toBe(zone.id);
      expect(memberA.zoneId).not.toBe('zone');
      expect(memberB.zoneId).toBeUndefined();
   });

   it('leaves a reference\'s sourceDrawerItemId untouched (it names a drawer item)', () => {
      const board = makeBoard();
      const result = reIdBoardAggregate(board);

      const reference = result.items.find((i) => i.content.kind === 'card');
      expect(reference!.content).toMatchObject({ mode: 'reference', sourceDrawerItemId: 'src-1' });
   });

   it('leaves a character element\'s sourceDrawerItemId untouched (it names a drawer item, not a board id)', () => {
      const board = makeBoard();
      const result = reIdBoardAggregate(board);

      const character = result.items.find((i) => i.content.kind === 'character');
      expect(character!.content).toMatchObject({ kind: 'character', sourceDrawerItemId: 'char-src', characterId: 'char-instance' });
   });

   it('clears the drawer link and preserves the viewport', () => {
      const board = makeBoard();
      const result = reIdBoardAggregate(board);

      expect(result.drawerItemId).toBeNull();
      expect(result.viewport).toEqual({ x: 5, y: 6, zoom: 2 });
   });

   it('does not mutate the input', () => {
      const board = makeBoard();
      reIdBoardAggregate(board);

      expect(board.id).toBe('board-old');
      expect(board.items[0].id).toBe('a');
      expect((board.items[2].content as { from: string }).from).toBe('a');
   });
});
