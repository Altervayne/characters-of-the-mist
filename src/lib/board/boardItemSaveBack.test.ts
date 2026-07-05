// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { useDrawerStore } from '@/lib/stores/drawerStore';
import {
   normalizeBoardItemInner,
   saveBoardItemToLinkedDrawerItem,
   saveBoardItemAsToDrawer,
   imageBoardContentToCard,
   saveBoardImageAsToDrawer,
} from './boardItemSaveBack';

// -- Type Imports --
import type { Card, ImageCardDetails, StatusTracker } from '@/lib/types/character';
import type { ImageBoardContent } from '@/lib/types/board';
import type { DrawerItemContent, GeneralItemType, GameSystem } from '@/lib/types/drawer';

/*
 * Unit tests for the board-item save-back helpers against fake-indexeddb. Covers the shared
 * cast+normalize (the `isFlipped` landmine, the game/type derivation), the Save write-back-by-id round
 * trip (present + dangling), and the Save-As mint (the new id + queued pending drop).
 */

/** A flipped challenge card copy (as it lives on the board); Save must land it face-up in the library. */
function makeCardData(overrides: Partial<Card> = {}): Card {
   return {
      id: 'card-1',
      title: 'Nemesis',
      order: 0,
      isFlipped: true,
      cardType: 'CHALLENGE_CARD',
      details: { game: 'LEGENDS', challengeLevel: 1 } as Card['details'],
      ...overrides,
   } as Card;
}

/** A status tracker copy (game-agnostic -> NEUTRAL). */
function makeTrackerData(overrides: Partial<StatusTracker> = {}): StatusTracker {
   return { id: 'trk-1', name: 'Wounded', trackerType: 'STATUS', tiers: [true, false, false], ...overrides };
}

/** Seeds a drawer item a board copy could be linked to (its source twin). */
function seedDrawerItem(itemId: string, displayName: string, type: GeneralItemType, game: GameSystem, content: DrawerItemContent) {
   return drawerDatabase.items.add({
      id: itemId,
      name: displayName,
      parentFolderId: 'root',
      order: 0,
      game,
      type,
      createdAt: 0,
      updatedAt: 0,
      content,
   });
}

beforeEach(async () => {
   await drawerDatabase.items.clear();
   useDrawerStore.setState({ pendingItem: null });
});

describe('normalizeBoardItemInner (the single cast + normalize boundary)', () => {
   it('normalizes a card face-up and derives its type/game from the aggregate', () => {
      const result = normalizeBoardItemInner(makeCardData({ isFlipped: true }));
      expect(result).not.toBeNull();
      expect(result!.type).toBe('CHALLENGE_CARD');
      expect(result!.game).toBe('LEGENDS');
      expect((result!.content as Card).isFlipped).toBe(false);
   });

   it('derives a tracker as its *_TRACKER type and NEUTRAL game (trackers are game-agnostic)', () => {
      const result = normalizeBoardItemInner(makeTrackerData());
      expect(result).not.toBeNull();
      expect(result!.type).toBe('STATUS_TRACKER');
      expect(result!.game).toBe('NEUTRAL');
   });

   it('maps each tracker kind to its drawer type', () => {
      expect(normalizeBoardItemInner({ trackerType: 'STORY_TAG', name: 'On Fire' } as unknown)!.type).toBe('STORY_TAG_TRACKER');
      expect(normalizeBoardItemInner({ trackerType: 'STORY_THEME', name: 'Theme' } as unknown)!.type).toBe('STORY_THEME_TRACKER');
   });

   it('deep-clones so normalizing never mutates the board item copy', () => {
      const source = makeCardData({ isFlipped: true });
      const result = normalizeBoardItemInner(source);
      expect(source.isFlipped).toBe(true); // the board copy is untouched
      expect((result!.content as Card).isFlipped).toBe(false);
      expect(result!.content).not.toBe(source);
   });

   it('returns null for data that is not a recognizable card/tracker', () => {
      expect(normalizeBoardItemInner({ foo: 'bar' })).toBeNull();
   });
});

describe('saveBoardItemToLinkedDrawerItem (Save / write-back by id)', () => {
   it('replaces the source item content with the normalized card, landing it face-up and keeping the item metadata', async () => {
      await seedDrawerItem('item-1', 'My Nemesis', 'CHALLENGE_CARD', 'LEGENDS', makeCardData({ title: 'Stale', isFlipped: false }));

      const result = await saveBoardItemToLinkedDrawerItem('item-1', makeCardData({ title: 'Edited', isFlipped: true }));

      expect(result.linkedItemUpdated).toBe(true);
      const item = await drawerDatabase.items.get('item-1');
      expect((item!.content as Card).title).toBe('Edited');
      // The transient flip is zeroed - never persist a face-down card.
      expect((item!.content as Card).isFlipped).toBe(false);
      // The drawer item's own metadata (display name, parent, order) is untouched.
      expect(item!.name).toBe('My Nemesis');
      expect(item!.parentFolderId).toBe('root');
      expect(item!.order).toBe(0);
   });

   it('replaces a tracker source with the normalized tracker content', async () => {
      await seedDrawerItem('trk-item', 'A Status', 'STATUS_TRACKER', 'NEUTRAL', makeTrackerData({ name: 'Stale' }));

      const result = await saveBoardItemToLinkedDrawerItem('trk-item', makeTrackerData({ name: 'Bleeding', tiers: [true, true, false] }));

      expect(result.linkedItemUpdated).toBe(true);
      const item = await drawerDatabase.items.get('trk-item');
      expect((item!.content as StatusTracker).name).toBe('Bleeding');
      expect((item!.content as StatusTracker).tiers).toEqual([true, true, false]);
   });

   it('reports linkedItemUpdated:false and writes nothing when the source is dangling (deleted)', async () => {
      const result = await saveBoardItemToLinkedDrawerItem('item-gone', makeCardData());

      expect(result.linkedItemUpdated).toBe(false);
      expect(await drawerDatabase.items.get('item-gone')).toBeUndefined();
      expect(await drawerDatabase.items.count()).toBe(0);
   });

   it('reports linkedItemUpdated:false when the inner data does not normalize (no write)', async () => {
      await seedDrawerItem('item-1', 'Src', 'CHALLENGE_CARD', 'LEGENDS', makeCardData());
      const result = await saveBoardItemToLinkedDrawerItem('item-1', { garbage: true });

      expect(result.linkedItemUpdated).toBe(false);
      // The source is untouched - its title never changed.
      expect((await drawerDatabase.items.get('item-1'))!.content).toMatchObject({ title: 'Nemesis' });
   });
});

describe('saveBoardItemAsToDrawer (Save As / mint + queue)', () => {
   it('returns a new id and queues a pending drop under it, face-up, with the right game/type', () => {
      const id = saveBoardItemAsToDrawer(makeCardData({ isFlipped: true }), 'folder-9');

      expect(id).toBeTruthy();
      const pending = useDrawerStore.getState().pendingItem;
      expect(pending).not.toBeNull();
      expect(pending!.presetId).toBe(id);
      expect(pending!.type).toBe('CHALLENGE_CARD');
      expect(pending!.game).toBe('LEGENDS');
      expect(pending!.parentFolderId).toBe('folder-9');
      expect(pending!.defaultName).toBe('Nemesis');
      expect((pending!.content as Card).isFlipped).toBe(false);
   });

   it('queues a tracker Save-As as NEUTRAL / *_TRACKER, named from the tracker', () => {
      const id = saveBoardItemAsToDrawer(makeTrackerData({ name: 'Wounded' }));

      const pending = useDrawerStore.getState().pendingItem;
      expect(pending!.presetId).toBe(id);
      expect(pending!.type).toBe('STATUS_TRACKER');
      expect(pending!.game).toBe('NEUTRAL');
      expect(pending!.defaultName).toBe('Wounded');
   });

   it('returns null and queues nothing when the inner data does not normalize', () => {
      const id = saveBoardItemAsToDrawer({ nope: true });
      expect(id).toBeNull();
      expect(useDrawerStore.getState().pendingItem).toBeNull();
   });

   it('falls back to a placeholder name when the card has no title', () => {
      saveBoardItemAsToDrawer(makeCardData({ title: '' }));
      expect(useDrawerStore.getState().pendingItem!.defaultName).toBe('New Item');
   });
});

describe('imageBoardContentToCard (board image -> IMAGE_CARD)', () => {
   it('builds a game-agnostic IMAGE_CARD carrying the asset + fit, face-up', () => {
      const image: ImageBoardContent = { kind: 'image', assetId: 'asset-hash', fit: 'contain' };
      const card = imageBoardContentToCard(image, 'My Image');

      expect(card.cardType).toBe('IMAGE_CARD');
      expect(card.title).toBe('My Image');
      expect(card.isFlipped).toBe(false);
      const details = card.details as ImageCardDetails;
      expect(details.game).toBe('NEUTRAL');
      expect(details.assetId).toBe('asset-hash');
      expect(details.fit).toBe('contain');
      // Seeds the portrait footprint the sheet card reuses.
      expect(details.width).toBeGreaterThan(0);
      expect(details.height).toBeGreaterThan(0);
   });

   it('routes through the shared save so it queues as an IMAGE_CARD / NEUTRAL', () => {
      const id = saveBoardImageAsToDrawer({ kind: 'image', assetId: 'asset-hash', fit: 'cover' }, 'My Image', 'folder-3');

      expect(id).toBeTruthy();
      const pending = useDrawerStore.getState().pendingItem!;
      expect(pending.presetId).toBe(id);
      expect(pending.type).toBe('IMAGE_CARD');
      expect(pending.game).toBe('NEUTRAL');
      expect(pending.parentFolderId).toBe('folder-3');
      expect(pending.defaultName).toBe('My Image');
      expect((pending.content as Card).cardType).toBe('IMAGE_CARD');
   });

   it('returns null and queues nothing when the image has no asset (assetId: null)', () => {
      const id = saveBoardImageAsToDrawer({ kind: 'image', assetId: null, fit: 'cover' }, 'Empty');
      expect(id).toBeNull();
      expect(useDrawerStore.getState().pendingItem).toBeNull();
   });
});

describe('Save-As -> addItem preset-id link (the presetId landmine)', () => {
   it('creates the drawer item under the minted id when the pending drop is confirmed', async () => {
      const id = saveBoardItemAsToDrawer(makeCardData());
      expect(id).toBeTruthy();

      const pending = useDrawerStore.getState().pendingItem!;
      // Confirm the pending drop the way the modification window does: addItem with the threaded presetId.
      const createdId = await useDrawerStore
         .getState()
         .actions.addItem('Nemesis', pending.game, pending.type, pending.content, pending.parentFolderId, pending.presetId);

      expect(createdId).toBe(id);
      const item = await drawerDatabase.items.get(id!);
      expect(item).toBeDefined();
      expect(item!.type).toBe('CHALLENGE_CARD');
      // A card copy has no `drawerItemId` to sniff, so only the explicit presetId can make this link hold.
      expect(item!.id).toBe(id);
   });
});
