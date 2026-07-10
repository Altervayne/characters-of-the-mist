// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { planNoteRefreeze, planNoteSourceStamp } from './refreezeNoteReferences';

// -- Type Imports --
import type { BoardItemRecord } from './boardRecords';
import type { BoardItemContent, Note, NoteBoardContent } from '@/lib/types/board';

/*
 * Tests for the pure reference-sync plans: on closing a drawer-less note's tab, which references become
 * frozen copies (re-freeze); and on Saving a note to the drawer, which references get their `sourceDrawerItemId`
 * stamped (source-stamp). The apply step (open-board in-memory write vs closed-board persist) is store/db
 * integration, verified live.
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

describe('planNoteSourceStamp', () => {
   it('stamps sourceDrawerItemId onto every unstamped live reference to the note, keeping noteId + lastKnown', () => {
      const items = [
         record('i1', 'b1', { kind: 'note', mode: 'reference', noteId: 'n1', lastKnown: { id: 'n1', title: 'k', body: 'k' } }),
         record('i2', 'b2', { kind: 'note', mode: 'reference', noteId: 'n1' }),
         record('i3', 'b1', { kind: 'note', mode: 'reference', noteId: 'OTHER' }),      // different note
         record('i4', 'b1', { kind: 'note', mode: 'copy', data: { id: 'x', title: '', body: '' } }), // a copy
      ];

      const plan = planNoteSourceStamp(items, 'n1', 'drawer-9');

      expect(plan.map((entry) => entry.id)).toEqual(['i1', 'i2']);
      // Stays a reference, gains the drawer source, keeps its id + lastKnown.
      expect(plan[0].content).toEqual({ kind: 'note', mode: 'reference', noteId: 'n1', sourceDrawerItemId: 'drawer-9', lastKnown: { id: 'n1', title: 'k', body: 'k' } });
      expect(plan[1].content).toEqual({ kind: 'note', mode: 'reference', noteId: 'n1', sourceDrawerItemId: 'drawer-9' });
   });

   it('skips a reference already pointing at that drawer item (a re-save writes nothing)', () => {
      const items = [record('i1', 'b1', { kind: 'note', mode: 'reference', noteId: 'n1', sourceDrawerItemId: 'drawer-9' })];
      expect(planNoteSourceStamp(items, 'n1', 'drawer-9')).toEqual([]);
   });

   it('re-stamps a reference that points at a DIFFERENT drawer item', () => {
      const items = [record('i1', 'b1', { kind: 'note', mode: 'reference', noteId: 'n1', sourceDrawerItemId: 'old' })];
      const plan = planNoteSourceStamp(items, 'n1', 'new');
      expect((plan[0].content as Extract<NoteBoardContent, { mode: 'reference' }>).sourceDrawerItemId).toBe('new');
   });

   it('is a no-op when no board item references the note', () => {
      const items = [record('i3', 'b1', { kind: 'note', mode: 'reference', noteId: 'OTHER' })];
      expect(planNoteSourceStamp(items, 'n1', 'drawer-9')).toEqual([]);
   });
});
