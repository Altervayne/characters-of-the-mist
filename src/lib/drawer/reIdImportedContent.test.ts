// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { reIdImportedItemContent, reIdImportedFolderTree } from './reIdImportedContent';

// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { DrawerItemContent, Folder } from '@/lib/types/drawer';

/*
 * Cross-reference-safe import re-ID. A blanket `deepReId` over an imported subtree remints every `id`
 * independently and so breaks the cross-refs a nested character carries: the sheet-layout manifest names
 * card/journal ids, and a journal bookmark names a page id by `pageId` (a differently-named field deepReId
 * never touches). These tests lock the type-aware re-ID that keeps those consistent.
 */

/** A character with a HAND-ORDERED manifest and a journal whose bookmark points at a page. */
function characterWithCrossRefs(): Character {
   return {
      id: 'char-src', name: 'Hero', game: 'LEGENDS', drawerItemId: 'drawer-1',
      cards: [
         { id: 'c1', title: 'A', isFlipped: false, cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } },
         { id: 'c2', title: 'B', isFlipped: false, cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } },
      ],
      journals: [
         { id: 'j1', title: 'Log', pages: [{ id: 'p1', text: 'first' }, { id: 'p2', text: 'second' }], bookmarks: [{ id: 'b1', pageId: 'p2', label: 'Jump' }] },
      ],
      // Deliberately NOT the default (card,card,journal) order - the user hand-sorted it.
      sheetLayout: [{ kind: 'card', id: 'c2' }, { kind: 'journal', id: 'j1' }, { kind: 'card', id: 'c1' }],
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
   } as unknown as Character;
}

function assertManifestConsistent(ch: Character) {
   const cardIds = new Set(ch.cards.map((c) => c.id));
   const journalIds = new Set(ch.journals.map((j) => j.id));
   // Every manifest entry still names a real card / journal (nothing desynced).
   for (const entry of ch.sheetLayout) {
      const ok = entry.kind === 'card' ? cardIds.has(entry.id) : journalIds.has(entry.id);
      expect(ok).toBe(true);
   }
   // The hand-sorted kind sequence survives.
   expect(ch.sheetLayout.map((e) => e.kind)).toEqual(['card', 'journal', 'card']);
   // The journal bookmark still resolves to one of its pages.
   const j = ch.journals[0];
   const pageIds = new Set(j.pages.map((p) => p.id));
   expect(pageIds.has(j.bookmarks[0].pageId)).toBe(true);
}

describe('reIdImportedItemContent', () => {
   it('keeps a JOURNAL / NOTE / FULL_BOARD content verbatim (id-preserving)', () => {
      const journal = { id: 'j', title: '', pages: [], bookmarks: [] } as unknown as DrawerItemContent;
      const note = { id: 'n', title: '', body: '' } as unknown as DrawerItemContent;
      const board = { id: 'b', name: '', items: [], viewport: { x: 0, y: 0, zoom: 1 } } as unknown as DrawerItemContent;
      expect(reIdImportedItemContent('JOURNAL', journal)).toBe(journal);
      expect(reIdImportedItemContent('NOTE', note)).toBe(note);
      expect(reIdImportedItemContent('FULL_BOARD', board)).toBe(board);
   });

   it('deep-re-IDs a cross-ref-free card (fresh id, independent copy)', () => {
      const card = { id: 'c', title: '', isFlipped: false, cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } } as unknown as DrawerItemContent;
      const fresh = reIdImportedItemContent('CHARACTER_THEME', card) as { id: string };
      expect(fresh.id).not.toBe('c');
   });

   it('routes a FULL_CHARACTER_SHEET through the aggregate re-id (fresh id, consistent manifest)', () => {
      const fresh = reIdImportedItemContent('FULL_CHARACTER_SHEET', characterWithCrossRefs() as unknown as DrawerItemContent) as Character;
      expect(fresh.id).not.toBe('char-src');
      expect(fresh.drawerItemId).toBeUndefined(); // an imported copy can't stale-link to the source drawer item
      assertManifestConsistent(fresh);
   });
});

describe('reIdImportedFolderTree', () => {
   it('fresh folder + item ids, and each nested character keeps its manifest + bookmarks consistent', () => {
      const folder = {
         id: 'f1', name: 'Party',
         items: [
            { id: 'item-char', game: 'LEGENDS', type: 'FULL_CHARACTER_SHEET', name: 'Hero', content: characterWithCrossRefs() },
            { id: 'item-theme', game: 'LEGENDS', type: 'CHARACTER_THEME', name: 'Theme', content: { id: 'theme-c', title: '', isFlipped: false, cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } } },
         ],
         folders: [
            { id: 'sub', name: 'Sub', items: [{ id: 'nested-char', game: 'LEGENDS', type: 'FULL_CHARACTER_SHEET', name: 'H2', content: characterWithCrossRefs() }], folders: [] },
         ],
      } as unknown as Folder;

      const fresh = reIdImportedFolderTree(folder);

      // Structure preserved.
      expect(fresh.items).toHaveLength(2);
      expect(fresh.folders[0].items).toHaveLength(1);
      // Fresh ids at every wrapper level.
      expect(fresh.id).not.toBe('f1');
      expect(fresh.items[0].id).not.toBe('item-char');
      expect(fresh.folders[0].id).not.toBe('sub');
      // Root character: fresh identity, consistent cross-refs.
      const rootChar = fresh.items[0].content as unknown as Character;
      expect(rootChar.id).not.toBe('char-src');
      assertManifestConsistent(rootChar);
      // Cross-ref-free theme card: reminted.
      expect((fresh.items[1].content as { id: string }).id).not.toBe('theme-c');
      // Nested (deeper folder) character also stays consistent.
      assertManifestConsistent(fresh.folders[0].items[0].content as unknown as Character);
   });

   it('leaves the input untouched', () => {
      const folder = { id: 'f1', name: 'F', items: [{ id: 'i1', game: 'LEGENDS', type: 'FULL_CHARACTER_SHEET', name: 'H', content: characterWithCrossRefs() }], folders: [] } as unknown as Folder;
      reIdImportedFolderTree(folder);
      expect(folder.id).toBe('f1');
      expect(folder.items[0].id).toBe('i1');
      expect((folder.items[0].content as unknown as Character).id).toBe('char-src');
   });
});
