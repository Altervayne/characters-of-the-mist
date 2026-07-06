// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { exportHandleFor } from './useCharacterSheetExport';
import { mapItemToStorableInfo } from '@/lib/utils/dnd';
import { generateExportFilename } from '@/lib/utils/export-import';

// -- Type Imports --
import type { Journal } from '@/lib/types/board';
import type { Card, Tracker } from '@/lib/types/character';

/*
 * The journal export path: a journal maps to JOURNAL/NEUTRAL, its filename handle comes from the first
 * page's first line (falling back when blank), and the derived filename carries JOURNAL. The card /
 * tracker handles are unchanged (title / name), asserted so the journal branch didn't disturb them.
 */

const journal = (firstPageText: string): Journal => ({
   id: 'j1',
   pages: [{ id: 'p1', text: firstPageText }, { id: 'p2', text: 'Second page' }],
   bookmarks: [],
});

describe('exportHandleFor', () => {
   it('derives a journal handle from the first line of its first page', () => {
      expect(exportHandleFor(journal('The Ashfall Job\nmore detail'), 'Untitled Journal')).toBe('The Ashfall Job');
   });

   it('falls back to the generic label when the journal has no page text', () => {
      expect(exportHandleFor(journal('   '), 'Untitled Journal')).toBe('Untitled Journal');
      expect(exportHandleFor({ id: 'j2', pages: [], bookmarks: [] }, 'Untitled Journal')).toBe('Untitled Journal');
   });

   it('leaves the card handle (title) untouched', () => {
      const card = { cardType: 'CHALLENGE_CARD', title: 'Pack of Hyenas', details: { game: 'LEGENDS' } } as unknown as Card;
      expect(exportHandleFor(card, 'Untitled Journal')).toBe('Pack of Hyenas');
   });

   it('leaves the tracker handle (name) untouched', () => {
      const tracker = { trackerType: 'STATUS', name: 'Bleeding' } as unknown as Tracker;
      expect(exportHandleFor(tracker, 'Untitled Journal')).toBe('Bleeding');
   });
});

describe('journal export mapping + filename', () => {
   it('maps a journal to JOURNAL / NEUTRAL', () => {
      expect(mapItemToStorableInfo(journal('Notes'))).toEqual(['JOURNAL', 'NEUTRAL']);
   });

   it('produces a sane JOURNAL filename carrying the handle', () => {
      const [type, game] = mapItemToStorableInfo(journal('The Ashfall Job'))!;
      const handle = exportHandleFor(journal('The Ashfall Job'), 'Untitled Journal');
      const fileName = generateExportFilename(game, type, handle);
      // The filename carries the item type and the derived handle (exact date suffix is generateExportFilename's).
      expect(fileName).toContain('Journal');
      expect(fileName).toContain('The Ashfall Job');
   });
});
