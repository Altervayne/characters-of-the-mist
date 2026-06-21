// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { saveCharacter } from '@/lib/character/characterRepository';
import { collectReferencedAssetHashes } from './collectReferencedAssetHashes';

// -- Type Imports --
import type { Card, Character } from '@/lib/types/character';
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * Unit tests for the reference collector against fake-indexeddb with synthetic
 * characters and drawer items. `assetId` does not exist on any card type yet, so the
 * fixtures attach it via a cast - exactly the forward-compatible shape the consumer
 * series will produce.
 */

/** A card carrying (or not) a `details.assetId`, built loosely since the field is not in the type yet. */
function makeCard(id: string, assetId: string | null): Card {
   return {
      id,
      title: '',
      order: 0,
      isFlipped: false,
      cardType: 'CHARACTER_CARD',
      details: { assetId },
   } as unknown as Card;
}

/** A minimal character holding the given cards. */
function makeCharacter(id: string, cards: Card[]): Character {
   return {
      id,
      name: 'Hero',
      game: 'LEGENDS',
      cards,
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
   } as unknown as Character;
}

/** Adds a drawer item with arbitrary content directly (the GC restriction is on the GC module, not tests). */
function seedDrawerItem(id: string, content: DrawerItemContent) {
   return drawerDatabase.items.add({
      id,
      name: id,
      parentFolderId: 'root',
      order: 0,
      game: 'LEGENDS',
      type: 'CHARACTER_CARD',
      content,
   });
}

/** Adds a board item row directly (the kind drives whether it carries an asset reference). */
function seedBoardItem(id: string, kind: 'image' | 'post-it', assetId: string | null) {
   return drawerDatabase.boardItems.add({
      id,
      boardId: 'board-1',
      kind,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      z: 0,
      content: kind === 'image' ? { kind: 'image', assetId, fit: 'cover' } : { kind: 'post-it', text: '' },
   });
}

beforeEach(async () => {
   await drawerDatabase.characters.clear();
   await drawerDatabase.items.clear();
   await drawerDatabase.boardItems.clear();
});

describe('collectReferencedAssetHashes', () => {
   it('finds assetIds on a stored character\'s cards', async () => {
      await saveCharacter(makeCharacter('char-1', [makeCard('c1', 'asset-A'), makeCard('c2', 'asset-B')]));

      const referenced = await collectReferencedAssetHashes();

      expect(referenced).toEqual(new Set(['asset-A', 'asset-B']));
   });

   it('finds an assetId on a drawer item whose content is a single card', async () => {
      await seedDrawerItem('item-card', makeCard('c1', 'asset-C'));

      const referenced = await collectReferencedAssetHashes();

      expect(referenced.has('asset-C')).toBe(true);
   });

   it('finds assetIds on a drawer item whose content is a full character', async () => {
      await seedDrawerItem('item-char', makeCharacter('char-x', [makeCard('c1', 'asset-D')]));

      const referenced = await collectReferencedAssetHashes();

      expect(referenced.has('asset-D')).toBe(true);
   });

   it('unions references across characters and drawer items', async () => {
      await saveCharacter(makeCharacter('char-1', [makeCard('c1', 'asset-A')]));
      await seedDrawerItem('item-card', makeCard('c2', 'asset-B'));
      await seedDrawerItem('item-char', makeCharacter('char-x', [makeCard('c3', 'asset-C')]));

      const referenced = await collectReferencedAssetHashes();

      expect(referenced).toEqual(new Set(['asset-A', 'asset-B', 'asset-C']));
   });

   it('ignores cards without an assetId and returns empty when nothing references', async () => {
      await saveCharacter(makeCharacter('char-1', [makeCard('c1', null)]));

      const referenced = await collectReferencedAssetHashes();

      expect(referenced.size).toBe(0);
   });

   it('finds the assetId on a board image item (so the GC keeps board art)', async () => {
      await seedBoardItem('img-item', 'image', 'asset-board');
      await seedBoardItem('note-item', 'post-it', null); // a non-image item holds no reference

      const referenced = await collectReferencedAssetHashes();

      expect(referenced.has('asset-board')).toBe(true);
      expect(referenced.size).toBe(1);
   });

   it('ignores a board image item whose assetId is null (empty image box)', async () => {
      await seedBoardItem('img-empty', 'image', null);

      const referenced = await collectReferencedAssetHashes();

      expect(referenced.size).toBe(0);
   });
});
