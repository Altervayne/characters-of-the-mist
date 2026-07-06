// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { buildSheetLayout, resolveSheetLayout, appendSheetLayoutEntry, removeSheetLayoutEntry, reorderSheetLayoutEntries } from './sheetLayout';

// -- Type Imports --
import type { Character, Card } from '@/lib/types/character';
import type { Journal } from '@/lib/types/board';

/*
 * The sheet layout manifest: build/append/splice/reorder plus the self-healing read resolver (the
 * seatbelt for a desync between the manifest and its content arrays).
 */

const card = (id: string): Card => ({ id, title: '', isFlipped: false, cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } } as unknown as Card);
const journal = (id: string): Journal => ({ id, pages: [], bookmarks: [] });

const character = (cards: Card[], journals: Journal[], sheetLayout: Character['sheetLayout']): Pick<Character, 'cards' | 'journals' | 'sheetLayout'> =>
   ({ cards, journals, sheetLayout });

describe('buildSheetLayout', () => {
   it('emits every card in order, then every journal (behavior-preserving default)', () => {
      const result = buildSheetLayout({ cards: [card('c1'), card('c2')], journals: [journal('j1')] });
      expect(result).toEqual([
         { kind: 'card', id: 'c1' },
         { kind: 'card', id: 'c2' },
         { kind: 'journal', id: 'j1' },
      ]);
   });
});

describe('resolveSheetLayout (self-healing)', () => {
   it('passes a complete, valid manifest through unchanged', () => {
      const layout = [{ kind: 'card', id: 'c1' }, { kind: 'journal', id: 'j1' }] as Character['sheetLayout'];
      const result = resolveSheetLayout(character([card('c1')], [journal('j1')], layout));
      expect(result).toEqual(layout);
   });

   it('drops entries pointing at no live card/journal (an orphan)', () => {
      const layout = [{ kind: 'card', id: 'c1' }, { kind: 'card', id: 'gone' }] as Character['sheetLayout'];
      const result = resolveSheetLayout(character([card('c1')], [], layout));
      expect(result).toEqual([{ kind: 'card', id: 'c1' }]);
   });

   it('appends content the manifest never listed (cards before journals)', () => {
      const layout = [{ kind: 'journal', id: 'j1' }] as Character['sheetLayout'];
      const result = resolveSheetLayout(character([card('c1')], [journal('j1')], layout));
      // The listed journal keeps its slot; the missing card is appended after it.
      expect(result).toEqual([
         { kind: 'journal', id: 'j1' },
         { kind: 'card', id: 'c1' },
      ]);
   });

   it('de-dupes a manifest that lists the same id twice', () => {
      const layout = [{ kind: 'card', id: 'c1' }, { kind: 'card', id: 'c1' }] as Character['sheetLayout'];
      const result = resolveSheetLayout(character([card('c1')], [], layout));
      expect(result).toEqual([{ kind: 'card', id: 'c1' }]);
   });

   it('yields a permutation-with-completeness even from an empty manifest', () => {
      const result = resolveSheetLayout(character([card('c1'), card('c2')], [journal('j1')], []));
      expect(result).toEqual([
         { kind: 'card', id: 'c1' },
         { kind: 'card', id: 'c2' },
         { kind: 'journal', id: 'j1' },
      ]);
   });
});

describe('append / remove / reorder', () => {
   it('appendSheetLayoutEntry adds to the tail', () => {
      expect(appendSheetLayoutEntry([{ kind: 'card', id: 'c1' }], { kind: 'journal', id: 'j1' })).toEqual([
         { kind: 'card', id: 'c1' },
         { kind: 'journal', id: 'j1' },
      ]);
   });

   it('removeSheetLayoutEntry splices by id', () => {
      expect(removeSheetLayoutEntry([{ kind: 'card', id: 'c1' }, { kind: 'journal', id: 'j1' }], 'c1')).toEqual([
         { kind: 'journal', id: 'j1' },
      ]);
   });

   it('reorderSheetLayoutEntries moves fromId to toId\'s slot', () => {
      const layout = [{ kind: 'card', id: 'c1' }, { kind: 'journal', id: 'j1' }] as Character['sheetLayout'];
      expect(reorderSheetLayoutEntries(layout, 'j1', 'c1')).toEqual([
         { kind: 'journal', id: 'j1' },
         { kind: 'card', id: 'c1' },
      ]);
   });

   it('reorderSheetLayoutEntries is a no-op for a missing or identical id', () => {
      const layout = [{ kind: 'card', id: 'c1' }] as Character['sheetLayout'];
      expect(reorderSheetLayoutEntries(layout, 'c1', 'c1')).toBe(layout);
      expect(reorderSheetLayoutEntries(layout, 'nope', 'c1')).toBe(layout);
   });
});
