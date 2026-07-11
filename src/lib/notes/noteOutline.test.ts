// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Unit Under Test --
import { extractHeadings, slugifyHeading } from './noteOutline';

describe('slugifyHeading', () => {
   it('lowercases, trims, and hyphenates spaces (GitHub-style)', () => {
      expect(slugifyHeading('The Baron')).toBe('the-baron');
      expect(slugifyHeading('  Leading and trailing  ')).toBe('leading-and-trailing');
   });

   it('strips punctuation and collapses dash runs', () => {
      expect(slugifyHeading('Chapter 1: The End!')).toBe('chapter-1-the-end');
      expect(slugifyHeading('a  --  b')).toBe('a-b');
   });

   it('keeps Unicode letters/numbers', () => {
      expect(slugifyHeading('Café déjà 2')).toBe('café-déjà-2');
   });

   it('falls back to "section" for an all-punctuation title', () => {
      expect(slugifyHeading('!!!')).toBe('section');
      expect(slugifyHeading('')).toBe('section');
   });
});

describe('extractHeadings', () => {
   it('extracts ATX headings with correct levels and offsets', () => {
      const body = '# One\n\nsome text\n\n## Two\n\n### Three';
      const h = extractHeadings(body);
      expect(h.map((x) => [x.level, x.text, x.slug])).toEqual([
         [1, 'One', 'one'],
         [2, 'Two', 'two'],
         [3, 'Three', 'three'],
      ]);
      // `from` points at the heading line start; slicing there recovers the marker.
      expect(body.slice(h[1].from, h[1].from + 5)).toBe('## Tw');
   });

   it('strips a trailing closing-hash run and extra whitespace', () => {
      expect(extractHeadings('##  Spaced  ##  ')[0]).toMatchObject({ level: 2, text: 'Spaced', slug: 'spaced' });
   });

   it('detects setext H1 (===) and H2 (---)', () => {
      const body = 'Big Title\n=====\n\nintro\n\nSub Title\n-----\n\nbody';
      const h = extractHeadings(body);
      expect(h.map((x) => [x.level, x.text])).toEqual([[1, 'Big Title'], [2, 'Sub Title']]);
      // The setext heading spans the text line through the underline line.
      expect(body.slice(h[0].from, h[0].to)).toBe('Big Title\n=====');
   });

   it('does NOT treat a --- after a blank line (thematic break) as a heading', () => {
      // No paragraph text directly above the rule -> it is an <hr>, not a setext H2.
      expect(extractHeadings('intro\n\n---\n\nmore')).toEqual([]);
   });

   it('does NOT setext-ify a list item or table row underlined by ---', () => {
      expect(extractHeadings('- a list item\n---')).toEqual([]);
      expect(extractHeadings('| a | b |\n---')).toEqual([]);
   });

   it('preserves nesting order (H1 -> H2 -> H3, mixed ATX + setext)', () => {
      const body = 'Top\n===\n\n## Middle\n\n### Deep\n\nSecond\n---';
      expect(extractHeadings(body).map((x) => x.level)).toEqual([1, 2, 3, 2]);
   });

   it('dedupes repeated titles with -1/-2 in occurrence order', () => {
      const body = '# Notes\n\n## Notes\n\n### Notes';
      expect(extractHeadings(body).map((x) => x.slug)).toEqual(['notes', 'notes-1', 'notes-2']);
   });

   it('skips headings inside fenced code blocks (``` and ~~~)', () => {
      const body = '# Real\n\n```\n# Not a heading\n## Also not\n```\n\n~~~\n### Nope\n~~~\n\n## Real Two';
      expect(extractHeadings(body).map((x) => x.text)).toEqual(['Real', 'Real Two']);
   });

   it('omits an empty-text heading (a bare #)', () => {
      expect(extractHeadings('#\n\n# Kept')).toEqual([expect.objectContaining({ text: 'Kept' })]);
   });

   it('strips inline markdown from the display text (and the slug matches the plain text)', () => {
      expect(extractHeadings('## The **Baron** of `Dust`')[0]).toMatchObject({ text: 'The Baron of Dust', slug: 'the-baron-of-dust' });
      // A link heading: text is the link label, slug matches what the renderer's plain text would produce.
      expect(extractHeadings('# See [the map](#map)')[0]).toMatchObject({ text: 'See the map', slug: 'see-the-map' });
   });

   it('returns an empty array for a note with no headings', () => {
      expect(extractHeadings('just a paragraph\n\nand another')).toEqual([]);
   });
});
