import { describe, expect, it } from 'vitest';

import { parseMentions } from './parseMentions';

/*
 * The `[bracket]` mention parser: status vs tag by shape, plain text in order, and robustness to
 * malformed (unclosed) brackets.
 */

describe('parseMentions', () => {
   it('passes plain text through as one text segment', () => {
      expect(parseMentions('The pack circles the camp.')).toEqual([
         { type: 'text', text: 'The pack circles the camp.' },
      ]);
   });

   it('parses a status span (name-tier)', () => {
      expect(parseMentions('[sickened-2]')).toEqual([
         { type: 'status', name: 'sickened', tier: 2, raw: 'sickened-2' },
      ]);
   });

   it('parses a tag span (no name-tier shape)', () => {
      expect(parseMentions('[Concerned Villagers]')).toEqual([
         { type: 'tag', name: 'Concerned Villagers', raw: 'Concerned Villagers' },
      ]);
   });

   it('mixes text and mentions in order', () => {
      expect(parseMentions('Anyone caught is [sickened-2]; the [Concerned Villagers] watch.')).toEqual([
         { type: 'text', text: 'Anyone caught is ' },
         { type: 'status', name: 'sickened', tier: 2, raw: 'sickened-2' },
         { type: 'text', text: '; the ' },
         { type: 'tag', name: 'Concerned Villagers', raw: 'Concerned Villagers' },
         { type: 'text', text: ' watch.' },
      ]);
   });

   it('handles adjacent spans with no text between them', () => {
      expect(parseMentions('[choking-2][afraid-1]')).toEqual([
         { type: 'status', name: 'choking', tier: 2, raw: 'choking-2' },
         { type: 'status', name: 'afraid', tier: 1, raw: 'afraid-1' },
      ]);
   });

   it('renders an unclosed bracket literally, keeping the tail', () => {
      expect(parseMentions('watch out for [foo and more')).toEqual([
         { type: 'text', text: 'watch out for [foo and more' },
      ]);
   });

   it('leaves a stray closing bracket as literal text around a valid span', () => {
      expect(parseMentions('a ] b [choking-2] c')).toEqual([
         { type: 'text', text: 'a ] b ' },
         { type: 'status', name: 'choking', tier: 2, raw: 'choking-2' },
         { type: 'text', text: ' c' },
      ]);
   });

   it('treats a hyphenated tag without a trailing number as a tag', () => {
      expect(parseMentions('[well-armed]')).toEqual([
         { type: 'tag', name: 'well-armed', raw: 'well-armed' },
      ]);
   });
});
