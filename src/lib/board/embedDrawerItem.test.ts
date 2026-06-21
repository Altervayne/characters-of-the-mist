// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { embeddedSpecForDrawerItem } from './embedDrawerItem';

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
   it('embeds a card type as a deep copy independent of the source', () => {
      const source = makeDrawerItem(
         'CHARACTER_THEME',
         { cardType: 'CHARACTER_THEME', details: { game: 'LEGENDS', themeType: 'Origin' } } as unknown as DrawerItemContent,
      );

      const spec = embeddedSpecForDrawerItem(source);
      expect(spec).not.toBeNull();
      expect(spec!.kind).toBe('card');
      expect(spec!.content).toMatchObject({ kind: 'card', mode: 'copy' });

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
});
