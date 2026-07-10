// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { planNoteRefreeze } from './refreezeNoteReferences';

// -- Type Imports --
import type { BoardItemRecord } from './boardRecords';
import type { BoardItemContent, Note } from '@/lib/types/board';

/*
 * Tests for the pure re-freeze plan: on closing a drawer-less note's tab, which board items (its live
 * references) become frozen copies, and with what content. The apply step (open-board in-memory write vs
 * closed-board persist) is store/db integration, verified live.
 */

function record(id: string, boardId: string, content: BoardItemContent): BoardItemRecord {
   return { id, boardId, kind: content.kind, x: 0, y: 0, width: 260, height: 320, z: 0, content };
}

describe('planNoteRefreeze', () => {
   const latest: Note = { id: 'n1', title: 'Edited', body: 'edited after adopt' };

   it('re-freezes only the live references to THIS note, into copies carrying the latest content', () => {
      const items = [
         record('i1', 'b1', { kind: 'note', mode: 'reference', noteId: 'n1', sourceDrawerItemId: undefined, lastKnown: { id: 'n1', title: 'old', body: 'old' } }),
         record('i2', 'b2', { kind: 'note', mode: 'reference', noteId: 'n1' }),
         record('i3', 'b1', { kind: 'note', mode: 'reference', noteId: 'OTHER' }),      // a different note
         record('i4', 'b1', { kind: 'note', mode: 'copy', data: { id: 'x', title: '', body: '' } }), // already a copy
         record('i5', 'b1', { kind: 'post-it', mode: 'copy', data: { id: 'p', text: '' } }),          // not a note
      ];

      const plan = planNoteRefreeze(items, 'n1', latest);

      expect(plan.map((entry) => entry.id)).toEqual(['i1', 'i2']);
      expect(plan[0]).toMatchObject({ id: 'i1', boardId: 'b1' });
      // Each becomes a frozen copy carrying the LATEST content (not the stale lastKnown).
      expect(plan[0].content).toEqual({ kind: 'note', mode: 'copy', sourceDrawerItemId: undefined, data: latest });
      expect(plan[1].content).toEqual({ kind: 'note', mode: 'copy', sourceDrawerItemId: undefined, data: latest });
   });

   it('is a no-op when no board item references the note', () => {
      const items = [record('i3', 'b1', { kind: 'note', mode: 'reference', noteId: 'OTHER' })];
      expect(planNoteRefreeze(items, 'n1', latest)).toEqual([]);
   });

   it('deep-clones so each frozen copy is independent of the live note', () => {
      const items = [record('i1', 'b1', { kind: 'note', mode: 'reference', noteId: 'n1' })];
      const plan = planNoteRefreeze(items, 'n1', latest);
      latest.title = 'mutated';
      expect((plan[0].content as { data: Note }).data.title).toBe('Edited');
   });
});
