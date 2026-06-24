// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { embeddedSpecForDrawerItem, EMBEDDED_CARD_SIZE } from './embedDrawerItem';
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

   it('embeds a tracker type as a copy', () => {
      const source = makeDrawerItem('STATUS_TRACKER', { trackerType: 'STATUS', name: 'Wounded' } as unknown as DrawerItemContent);

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec!.kind).toBe('tracker');
      expect(spec!.content).toMatchObject({ kind: 'tracker', mode: 'copy' });
   });

   it('returns null for non-embeddable types (full sheets, etc.)', () => {
      expect(embeddedSpecForDrawerItem(makeDrawerItem('FULL_CHARACTER_SHEET', {} as DrawerItemContent))).toBeNull();
   });

   it('sizes a theme/character card to the native sheet footprint', () => {
      const spec = embeddedSpecForDrawerItem(
         makeDrawerItem('CHARACTER_THEME', { cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS' } } as unknown as DrawerItemContent),
      );
      expect(spec).toMatchObject({ width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height });
   });

   it('sizes an image card to its own stored dimensions, defaulting when unset', () => {
      const withSize = embeddedSpecForDrawerItem(
         makeDrawerItem('IMAGE_CARD', { cardType: 'IMAGE_CARD', details: { game: 'LEGENDS', width: 320, height: 240 } } as unknown as DrawerItemContent),
      );
      expect(withSize).toMatchObject({ width: 320, height: 240 });

      const noSize = embeddedSpecForDrawerItem(
         makeDrawerItem('IMAGE_CARD', { cardType: 'IMAGE_CARD', details: { game: 'LEGENDS' } } as unknown as DrawerItemContent),
      );
      expect(noSize).toMatchObject({ width: DEFAULT_IMAGE_CARD_SIZE.width, height: DEFAULT_IMAGE_CARD_SIZE.height });
   });
});
