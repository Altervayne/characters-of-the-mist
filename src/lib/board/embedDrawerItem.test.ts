// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { embeddedSpecForDrawerItem, embeddedSpecForComponent, characterElementSpec, EMBEDDED_CARD_SIZE, EMBEDDED_TRACKER_SIZES, EMBEDDED_POSTIT_SIZE, EMBEDDED_JOURNAL_SIZE, NOTE_ELEMENT_SIZE } from './embedDrawerItem';
import { DEFAULT_IMAGE_CARD_SIZE } from '@/lib/constants/imageCard';

// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';
import type { DrawerItemContent } from '@/lib/types/drawer';
import type { Card, Tracker } from '@/lib/types/character';
import type { Journal } from '@/lib/types/board';

/*
 * Tests for the drawer-item -> embedded-board-item spec. The key guarantee is that the
 * embedded content is a deep COPY: a later edit to the drawer item must never reach the
 * board copy.
 */

function makeDrawerItem(type: GeneralItemType, content: DrawerItemContent): DrawerItem {
   return { id: 'item-1', name: 'Item', parentFolderId: 'root', order: 0, game: 'LEGENDS', type, content } as DrawerItem;
}

describe('embeddedSpecForDrawerItem', () => {
   it('embeds a card type as a deep copy independent of the source, recording the source id', () => {
      const source = makeDrawerItem(
         'CHARACTER_THEME',
         { cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS', themeType: 'Origin' } } as unknown as DrawerItemContent,
      );

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec).not.toBeNull();
      expect(spec!.kind).toBe('card');
      // The copy records `sourceDrawerItemId` so it can later be toggled to a reference.
      expect(spec!.content).toMatchObject({ kind: 'card', mode: 'copy', sourceDrawerItemId: 'item-1' });

      // Mutating the source content must not change the board copy.
      (source.content as { details: { themeType: string } }).details.themeType = 'Adventure';
      const copied = spec!.content as { mode: 'copy'; data: { details: { themeType: string } } };
      expect(copied.data.details.themeType).toBe('Origin');
   });

   it('embeds a tracker type as a copy, sized to its native footprint', () => {
      const source = makeDrawerItem('STATUS_TRACKER', { trackerType: 'STATUS', name: 'Wounded' } as unknown as DrawerItemContent);

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec!.kind).toBe('tracker');
      expect(spec!.content).toMatchObject({ kind: 'tracker', mode: 'copy' });
      expect(spec).toMatchObject(EMBEDDED_TRACKER_SIZES.STATUS);

      const theme = embeddedSpecForDrawerItem(makeDrawerItem('STORY_THEME_TRACKER', { trackerType: 'STORY_THEME', name: 'Theme' } as unknown as DrawerItemContent));
      expect(theme).toMatchObject(EMBEDDED_TRACKER_SIZES.STORY_THEME);
   });

   it('returns null for non-droppable types (folders, boards)', () => {
      expect(embeddedSpecForDrawerItem(makeDrawerItem('FOLDER', {} as DrawerItemContent))).toBeNull();
   });

   it('embeds a CHALLENGE_CARD as a card copy, sized to the native card footprint (not null)', () => {
      const source = makeDrawerItem(
         'CHALLENGE_CARD',
         { cardType: 'CHALLENGE_CARD', details: { game: 'LEGENDS', challengeLevel: 1 } } as unknown as DrawerItemContent,
      );

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec).not.toBeNull();
      expect(spec).toMatchObject({ kind: 'card', width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
      expect(spec!.content).toMatchObject({ kind: 'card', mode: 'copy', sourceDrawerItemId: 'item-1' });
   });

   it('re-embeds a saved POST_IT as a source-bearing copy with a FRESH note id (independent of the drawer twin)', () => {
      const source = makeDrawerItem('POST_IT', { id: 'note-src', text: 'Bandit Ambush', color: '#bfdbfe' } as unknown as DrawerItemContent);

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec).not.toBeNull();
      expect(spec).toMatchObject({ kind: 'post-it', width: EMBEDDED_POSTIT_SIZE.width, height: EMBEDDED_POSTIT_SIZE.height });
      // Source-bearing copy: keeps the Save write-back link and carries the note's text + color forward.
      expect(spec!.content).toMatchObject({ kind: 'post-it', mode: 'copy', sourceDrawerItemId: 'item-1', data: { text: 'Bandit Ambush', color: '#bfdbfe' } });
      // A fresh note id makes the board copy independent of the drawer twin's note id.
      const copied = spec!.content as { data: { id: string } };
      expect(copied.data.id).not.toBe('note-src');

      // Deep-independent: mutating the source note must not reach the board copy.
      (source.content as { text: string }).text = 'edited';
      expect((spec!.content as { data: { text: string } }).data.text).toBe('Bandit Ambush');
   });

   it('re-embeds a saved JOURNAL as a source-bearing copy with a FRESH top-level id, keeping pages + bookmarks intact', () => {
      const source = makeDrawerItem('JOURNAL', {
         id: 'journal-src',
         pages: [
            { id: 'page-a', text: 'Session one' },
            { id: 'page-b', text: 'Session two' },
         ],
         bookmarks: [
            { id: 'bm-1', pageId: 'page-a', label: 'Start' },
            { id: 'bm-2', pageId: 'page-b', label: 'The heist' },
         ],
      } as unknown as DrawerItemContent);

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec).not.toBeNull();
      expect(spec).toMatchObject({ kind: 'journal', width: EMBEDDED_JOURNAL_SIZE.width, height: EMBEDDED_JOURNAL_SIZE.height });
      // Source-bearing copy: keeps the Save write-back link.
      expect(spec!.content).toMatchObject({ kind: 'journal', mode: 'copy', sourceDrawerItemId: 'item-1' });

      const data = (spec!.content as { data: { id: string; pages: { id: string }[]; bookmarks: { pageId: string }[] } }).data;
      // A fresh TOP-LEVEL id makes the board copy independent of the drawer twin's journal id...
      expect(data.id).not.toBe('journal-src');
      // ...but page ids and bookmark pageId references are left UNTOUCHED (the deepReId landmine dodged):
      // a blind re-ID would rewrite page ids while leaving `pageId` alone, orphaning every bookmark.
      expect(data.pages.map((page) => page.id)).toEqual(['page-a', 'page-b']);
      expect(data.bookmarks.map((bookmark) => bookmark.pageId)).toEqual(['page-a', 'page-b']);
      // Every bookmark still resolves to a real page after the re-embed - no strays.
      const pageIds = new Set(data.pages.map((page) => page.id));
      expect(data.bookmarks.every((bookmark) => pageIds.has(bookmark.pageId))).toBe(true);

      // Deep-independent: mutating the source journal must not reach the board copy.
      (source.content as { pages: { text: string }[] }).pages[0].text = 'edited';
      expect((spec!.content as { data: { pages: { text: string }[] } }).data.pages[0].text).toBe('Session one');
   });

   it('drops a saved character sheet as a read-only character REFERENCE (no copy, records source + character ids)', () => {
      // The content is the Character; its id keys the open-tab lookup, the drawer id is the saved source.
      const spec = embeddedSpecForDrawerItem(makeDrawerItem('FULL_CHARACTER_SHEET', { id: 'char-1', name: 'Aria' } as unknown as DrawerItemContent));
      expect(spec).toMatchObject({ kind: 'character', content: { kind: 'character', sourceDrawerItemId: 'item-1', characterId: 'char-1' } });
      // Reference-only: no copy `data`, no `mode`.
      expect(spec!.content).not.toHaveProperty('data');
      expect(spec!.content).not.toHaveProperty('mode');
   });

   it('drops a saved NOTE as a live read-only REFERENCE tile (no copy, keyed by note + drawer ids)', () => {
      // The content is the Note; its id keys the open-tab lookup, the drawer id is the saved source.
      const spec = embeddedSpecForDrawerItem(makeDrawerItem('NOTE', { id: 'note-1', title: 'The Baron', body: 'Lore' } as unknown as DrawerItemContent));
      expect(spec).toMatchObject({ kind: 'note', width: NOTE_ELEMENT_SIZE.width, height: NOTE_ELEMENT_SIZE.height });
      expect(spec!.content).toMatchObject({ kind: 'note', mode: 'reference', noteId: 'note-1', sourceDrawerItemId: 'item-1' });
      // Reference-only: no frozen copy `data`.
      expect(spec!.content).not.toHaveProperty('data');
   });

   it('builds a character element for a SAVED tab character (links the drawer source)', () => {
      expect(characterElementSpec({ id: 'char-9', drawerItemId: 'drw-9' })).toMatchObject({
         kind: 'character',
         content: { kind: 'character', sourceDrawerItemId: 'drw-9', characterId: 'char-9' },
      });
   });

   it('builds a character element for an UNSAVED tab character too (keyed by id, no source)', () => {
      const spec = characterElementSpec({ id: 'char-9' });
      expect(spec).toMatchObject({ kind: 'character', content: { kind: 'character', characterId: 'char-9' } });
      // No drawer link yet - it reads live while the tab is open, then "removed without saving" once closed.
      expect(spec!.content).toMatchObject({ sourceDrawerItemId: undefined });
      // Only an absent character yields null.
      expect(characterElementSpec(null)).toBeNull();
   });

   it('sizes a theme/character card to the native sheet footprint', () => {
      const spec = embeddedSpecForDrawerItem(
         makeDrawerItem('CHARACTER_THEME', { cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } } as unknown as DrawerItemContent),
      );
      expect(spec).toMatchObject({ width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
   });

   it('shares the mapping with the drawer path, keyed off the drawer item content', () => {
      // The drawer path delegates to embeddedSpecForComponent(item.content), so a drawer card and its
      // bare content produce the same spec bar the drawer-only source id.
      const card = { cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS', themeType: 'Origin' } } as unknown as Card;
      const fromComponent = embeddedSpecForComponent(card);
      const fromDrawer = embeddedSpecForDrawerItem(makeDrawerItem('CHARACTER_THEME', card as unknown as DrawerItemContent));
      expect(fromComponent).toMatchObject({ kind: 'card', width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
      expect(fromDrawer).toMatchObject({ kind: 'card', width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
   });
});

/*
 * Tests for the shared card/tracker -> board spec used off the character sheet (a bare Card | Tracker,
 * no drawer wrapper). A sheet component is a self-contained COPY with NO `sourceDrawerItemId`.
 */
describe('embeddedSpecForComponent', () => {
   it('embeds a sheet card as a deep copy with NO drawer source id', () => {
      const card = { cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS', themeType: 'Origin' } } as unknown as Card;
      const spec = embeddedSpecForComponent(card);
      expect(spec).not.toBeNull();
      expect(spec!.kind).toBe('card');
      expect(spec).toMatchObject({ width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
      expect(spec!.content).toMatchObject({ kind: 'card', mode: 'copy' });
      // A sheet component is not from the drawer, so it carries no source id.
      expect(spec!.content).not.toHaveProperty('sourceDrawerItemId');

      // Deep copy: a later edit to the source card must not reach the board copy.
      (card as { details: { themeType: string } }).details.themeType = 'Adventure';
      const copied = spec!.content as { data: { details: { themeType: string } } };
      expect(copied.data.details.themeType).toBe('Origin');
   });

   it('embeds a CHALLENGE_CARD from the sheet as a card copy (not null)', () => {
      const card = { cardType: 'CHALLENGE_CARD', details: { game: 'LEGENDS', challengeLevel: 1 } } as unknown as Card;
      const spec = embeddedSpecForComponent(card);
      expect(spec).toMatchObject({ kind: 'card', width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
      expect(spec!.content).toMatchObject({ kind: 'card', mode: 'copy' });
   });

   it('embeds a sheet tracker as a copy sized to its native footprint, no drawer source id', () => {
      const status = embeddedSpecForComponent({ trackerType: 'STATUS', name: 'Wounded' } as unknown as Tracker);
      expect(status).toMatchObject({ kind: 'tracker', ...EMBEDDED_TRACKER_SIZES.STATUS });
      expect(status!.content).toMatchObject({ kind: 'tracker', mode: 'copy' });
      expect(status!.content).not.toHaveProperty('sourceDrawerItemId');

      const theme = embeddedSpecForComponent({ trackerType: 'STORY_THEME', name: 'Theme' } as unknown as Tracker);
      expect(theme).toMatchObject({ kind: 'tracker', ...EMBEDDED_TRACKER_SIZES.STORY_THEME });
   });

   it('drops a sheet IMAGE_CARD as a NATIVE image item, not an embed', () => {
      const spec = embeddedSpecForComponent(
         { cardType: 'IMAGE_CARD', details: { game: 'NEUTRAL', assetId: 'hash-1', fit: 'contain', width: 320, height: 240 } } as unknown as Card,
      );
      expect(spec).toMatchObject({ kind: 'image', width: 320, height: 240, content: { kind: 'image', assetId: 'hash-1', fit: 'contain' } });
      expect(spec!.content).not.toHaveProperty('mode');
      expect(spec!.content).not.toHaveProperty('sourceDrawerItemId');
   });

   it('embeds a sheet JOURNAL as a copy with a FRESH top-level id and NO drawer source, pages + bookmarks intact', () => {
      const journal: Journal = {
         id: 'journal-src',
         title: '',
         pages: [{ id: 'page-a', text: 'Session one' }, { id: 'page-b', text: 'Session two' }],
         bookmarks: [{ id: 'bm-1', pageId: 'page-a', label: 'Start' }],
      };
      const spec = embeddedSpecForComponent(journal);
      expect(spec).toMatchObject({ kind: 'journal', width: EMBEDDED_JOURNAL_SIZE.width, height: EMBEDDED_JOURNAL_SIZE.height });
      expect(spec!.content).toMatchObject({ kind: 'journal', mode: 'copy' });
      // A sheet component carries NO drawer source id.
      expect(spec!.content).not.toHaveProperty('sourceDrawerItemId');

      const data = (spec!.content as { data: { id: string; pages: { id: string; text: string }[]; bookmarks: { pageId: string }[] } }).data;
      // Fresh top-level id, but page ids + bookmark pageId references untouched (deepReId landmine dodged).
      expect(data.id).not.toBe('journal-src');
      expect(data.pages.map((page) => page.id)).toEqual(['page-a', 'page-b']);
      expect(data.bookmarks.map((bookmark) => bookmark.pageId)).toEqual(['page-a']);
      const pageIds = new Set(data.pages.map((page) => page.id));
      expect(data.bookmarks.every((bookmark) => pageIds.has(bookmark.pageId))).toBe(true);

      // Deep copy: a later edit to the source journal must not reach the board copy.
      journal.pages[0].text = 'edited';
      expect(data.pages[0].text).toBe('Session one');
   });
});

describe('embeddedSpecForDrawerItem (image)', () => {
   it('drops an image card as a NATIVE image item (not an embed), carrying asset/fit/size', () => {
      const withSize = embeddedSpecForDrawerItem(
         makeDrawerItem('IMAGE_CARD', { cardType: 'IMAGE_CARD', details: { game: 'NEUTRAL', assetId: 'hash-1', fit: 'contain', width: 320, height: 240 } } as unknown as DrawerItemContent),
      );
      expect(withSize).toMatchObject({ kind: 'image', width: 320, height: 240, content: { kind: 'image', assetId: 'hash-1', fit: 'contain' } });
      // A native image item has no embed machinery.
      expect(withSize!.content).not.toHaveProperty('sourceDrawerItemId');
      expect(withSize!.content).not.toHaveProperty('mode');

      // An empty frame (null asset) maps to a null-asset native image, defaulting size + fit.
      const empty = embeddedSpecForDrawerItem(
         makeDrawerItem('IMAGE_CARD', { cardType: 'IMAGE_CARD', details: { game: 'NEUTRAL', assetId: null } } as unknown as DrawerItemContent),
      );
      expect(empty).toMatchObject({ kind: 'image', width: DEFAULT_IMAGE_CARD_SIZE.width, height: DEFAULT_IMAGE_CARD_SIZE.height, content: { kind: 'image', assetId: null, fit: 'cover' } });
   });
});
