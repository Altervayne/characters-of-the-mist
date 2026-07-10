// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { markdownFilename, noteFromMarkdown, noteHasImages } from './noteMarkdownFile';
import { noteToMarkdown } from './noteMarkdown';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * The `.md` companion to `.cotm`: the has-images gate, the safe filename, and the import parse
 * (leading H1 -> title). Round-trips against `noteToMarkdown` so export/import stay inverses.
 */

function note(partial: Partial<Note>): Note {
   return { id: 'n', title: '', body: '', ...partial };
}

describe('noteHasImages', () => {
   it('is false for a plain text note', () => {
      expect(noteHasImages(note({ title: 'T', body: 'Just words.' }))).toBe(false);
   });

   it('is true when the note has a cover', () => {
      expect(noteHasImages(note({ body: 'Words.', cover: { hash: 'abc123', width: 38, aspect: 1 } }))).toBe(true);
   });

   it('is true when the body has an inline image', () => {
      expect(noteHasImages(note({ body: 'Before ![alt](asset:abc123) after.' }))).toBe(true);
   });

   it('is true for an image with an empty alt', () => {
      expect(noteHasImages(note({ body: '![](asset:deadbe)' }))).toBe(true);
   });
});

describe('markdownFilename', () => {
   it('uses the trimmed title with a .md extension', () => {
      expect(markdownFilename('The Baron')).toBe('The Baron.md');
   });

   it('falls back to note.md for an empty or whitespace title', () => {
      expect(markdownFilename('')).toBe('note.md');
      expect(markdownFilename('   ')).toBe('note.md');
   });

   it('strips filesystem-illegal characters', () => {
      expect(markdownFilename('a/b:c*d?"<>|e')).toBe('abcde.md');
   });

   it('collapses inner whitespace runs', () => {
      expect(markdownFilename('  The   Baron  ')).toBe('The Baron.md');
   });
});

describe('noteFromMarkdown', () => {
   it('takes a leading H1 as the title and the rest as the body', () => {
      const n = noteFromMarkdown('# The Baron\n\nHis history.', 'whatever.md');
      expect(n.title).toBe('The Baron');
      expect(n.body).toBe('His history.');
   });

   it('mints a fresh id', () => {
      const n = noteFromMarkdown('# T\n\nB', 'f.md');
      expect(typeof n.id).toBe('string');
      expect(n.id.length).toBeGreaterThan(0);
   });

   it('uses the filename (extension stripped) as the title when there is no leading H1', () => {
      const n = noteFromMarkdown('Just a body, no heading.', 'Session Recap.md');
      expect(n.title).toBe('Session Recap');
      expect(n.body).toBe('Just a body, no heading.');
   });

   it('does not treat an H2 as a title', () => {
      const n = noteFromMarkdown('## Not a title\n\nBody.', 'notes.markdown');
      expect(n.title).toBe('notes');
      expect(n.body).toBe('## Not a title\n\nBody.');
   });

   it('handles a title-only markdown (H1, no body)', () => {
      const n = noteFromMarkdown('# Lonely Title', 'x.md');
      expect(n.title).toBe('Lonely Title');
      expect(n.body).toBe('');
   });

   it('round-trips a titled note through noteToMarkdown', () => {
      const original = note({ title: 'The Baron', body: 'Line one.\n\nLine two.' });
      const parsed = noteFromMarkdown(noteToMarkdown(original), 'ignored.md');
      expect(parsed.title).toBe(original.title);
      expect(parsed.body).toBe(original.body);
   });
});
