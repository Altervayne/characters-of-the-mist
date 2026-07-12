// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { reIdNote } from './reIdNote';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * Tests for the Save-As note fork's pure re-id: a fresh id, everything else verbatim, source untouched.
 */

function makeNote(): Note {
   return {
      id: 'note-source',
      title: 'Session One',
      body: '# Heading\n\nBody text with a ![img](cotm-asset://abc).',
      cover: { hash: 'sha-cover', width: 80, aspect: 0.5 },
   };
}

describe('reIdNote', () => {
   it('mints a fresh id and copies title/body/cover verbatim', () => {
      const note = makeNote();
      const result = reIdNote(note);

      expect(result.id).not.toBe('note-source');
      expect(result.title).toBe('Session One');
      expect(result.body).toBe(note.body);
      expect(result.cover).toEqual({ hash: 'sha-cover', width: 80, aspect: 0.5 });
   });

   it('does not mutate the input', () => {
      const note = makeNote();
      reIdNote(note);
      expect(note.id).toBe('note-source');
   });

   it('yields three distinct identities across a Save-As twice (fork of a fork)', () => {
      const source = makeNote();
      const first = reIdNote(source);
      const second = reIdNote(first);
      expect(new Set([source.id, first.id, second.id]).size).toBe(3);
   });

   it('does not conflate: the fork id differs from the source id', () => {
      const source = makeNote();
      const fork = reIdNote(source);
      // A note tile / entity link resolving `source.id` can never land on `fork.id`.
      expect(fork.id).not.toBe(source.id);
   });
});
