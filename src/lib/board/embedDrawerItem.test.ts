// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { embeddedSpecForDrawerItem, characterElementSpec, EMBEDDED_CARD_SIZE, EMBEDDED_TRACKER_SIZES } from './embedDrawerItem';
import { DEFAULT_IMAGE_CARD_SIZE } from '@/lib/constants/imageCard';

// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';
import type { DrawerItemContent } from '@/lib/types/drawer';

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

   it('drops a saved character sheet as a read-only character REFERENCE (no copy, records source + character ids)', () => {
      // The content is the Character; its id keys the open-tab lookup, the drawer id is the saved source.
      const spec = embeddedSpecForDrawerItem(makeDrawerItem('FULL_CHARACTER_SHEET', { id: 'char-1', name: 'Aria' } as unknown as DrawerItemContent));
      expect(spec).toMatchObject({ kind: 'character', content: { kind: 'character', sourceDrawerItemId: 'item-1', characterId: 'char-1' } });
      // Reference-only: no copy `data`, no `mode`.
      expect(spec!.content).not.toHaveProperty('data');
      expect(spec!.content).not.toHaveProperty('mode');
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
