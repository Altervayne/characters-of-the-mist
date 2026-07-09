// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { noteToMarkdown } from './noteMarkdown';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * The plain-markdown mapping: the structured title leads the document as an H1 wherever a note becomes one
 * markdown string (print / copy / .md export). The cover never round-trips into the string.
 */

function note(partial: Partial<Note>): Note {
   return { id: 'n', title: '', body: '', ...partial };
}

describe('noteToMarkdown', () => {
   it('prepends the title as a leading H1 over the body', () => {
      expect(noteToMarkdown(note({ title: 'The Baron', body: 'His history.' }))).toBe('# The Baron\n\nHis history.');
   });

   it('emits the body alone for an untitled note (no empty H1)', () => {
      expect(noteToMarkdown(note({ title: '', body: 'Body only.' }))).toBe('Body only.');
   });

   it('treats a whitespace-only title as untitled', () => {
      expect(noteToMarkdown(note({ title: '   ', body: 'Body only.' }))).toBe('Body only.');
   });

   it('does not round-trip the cover into the string', () => {
      const md = noteToMarkdown(note({ title: 'T', body: 'B', cover: { hash: 'abc123', width: 38, aspect: 1 } }));
      expect(md).toBe('# T\n\nB');
      expect(md).not.toContain('abc123');
   });
});
