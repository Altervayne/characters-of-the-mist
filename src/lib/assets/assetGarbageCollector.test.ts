// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { saveCharacter } from '@/lib/character/characterRepository';
import { isPeriodicSweepWarranted, runSweep } from './assetGarbageCollector';

// -- Type Imports --
import type { AssetRecord } from './assetRecords';
import type { AssetSweepRecord } from './assetRepository';
import type { Card, Character } from '@/lib/types/character';

/*
 * Unit tests for the mark-and-sweep collector against fake-indexeddb. Synthetic
 * AssetRecords are inserted directly with controlled `createdAt` so the grace window
 * can be exercised deterministically. The GC logic is timer-free, so it is driven
 * here without any scheduling.
 */

const GRACE_MS = 5 * 60 * 1000;

/** Inserts a synthetic asset row with a controlled age. */
function seedAsset(hash: string, ageMs: number, byteSize = 100): Promise<string> {
   const record: AssetRecord = {
      hash,
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
      mimeType: 'image/webp',
      width: 10,
      height: 10,
      byteSize,
      createdAt: Date.now() - ageMs,
   };
   return drawerDatabase.assets.add(record);
}

/** A card referencing an asset, built loosely since `assetId` is not in the card type yet. */
function makeCard(assetId: string): Card {
   return { id: 'c1', title: '', order: 0, isFlipped: false, cardType: 'CHARACTER_CARD', details: { assetId } } as unknown as Card;
}

/** Stores a character that references `assetId`, so that hash counts as referenced. */
function referenceAsset(characterId: string, assetId: string) {
   const character = {
      id: characterId,
      name: 'Hero',
      game: 'LEGENDS',
      cards: [makeCard(assetId)],
      trackers: { statuses: [], storyTags: [], storyThemes: [] },
   } as unknown as Character;
   return saveCharacter(character);
}

beforeEach(async () => {
   await drawerDatabase.assets.clear();
   await drawerDatabase.characters.clear();
   await drawerDatabase.items.clear();
   await drawerDatabase.meta.clear();
});

describe('runSweep', () => {
   it('deletes unreferenced assets older than the grace window', async () => {
      await seedAsset('old-orphan', GRACE_MS + 60_000);

      const result = await runSweep('manual');

      expect(result.deleted).toBe(1);
      expect(await drawerDatabase.assets.get('old-orphan')).toBeUndefined();
   });

   it('keeps unreferenced assets younger than the grace window (the upload race guard)', async () => {
      await seedAsset('young-orphan', 1_000);

      const result = await runSweep('manual');

      expect(result.deleted).toBe(0);
      expect(await drawerDatabase.assets.get('young-orphan')).toBeDefined();
   });

   it('keeps referenced assets regardless of age', async () => {
      await seedAsset('referenced-old', GRACE_MS + 60_000);
      await referenceAsset('char-1', 'referenced-old');

      const result = await runSweep('manual');

      expect(result.deleted).toBe(0);
      expect(await drawerDatabase.assets.get('referenced-old')).toBeDefined();
   });

   it('reports the reclaimed count and summed byteSize', async () => {
      await seedAsset('orphan-a', GRACE_MS + 60_000, 100);
      await seedAsset('orphan-b', GRACE_MS + 60_000, 250);
      await seedAsset('young', 1_000, 999); // protected, must not be counted

      const result = await runSweep('manual');

      expect(result.deleted).toBe(2);
      expect(result.reclaimedBytes).toBe(350);
   });

   it('records assetsLastSwept bookkeeping (remaining count + reason)', async () => {
      await seedAsset('old-orphan', GRACE_MS + 60_000);
      await seedAsset('young', 1_000);

      await runSweep('startup');

      const row = await drawerDatabase.meta.get('assetsLastSwept');
      const bookkeeping = row?.value as AssetSweepRecord;
      expect(bookkeeping.assetCount).toBe(1); // one deleted, one (young) remains
      expect(bookkeeping.reason).toBe('startup');
      expect(typeof bookkeeping.at).toBe('number');
   });
});

describe('isPeriodicSweepWarranted', () => {
   it('is true when the asset count grew since the last sweep', async () => {
      await seedAsset('young', 1_000); // unreferenced+young: survives the sweep
      await runSweep('startup'); // records assetCount = 1
      await seedAsset('newcomer', 500); // count is now 2 > 1

      expect(await isPeriodicSweepWarranted()).toBe(true);
   });

   it('is false when nothing changed since the last sweep (no storage pressure)', async () => {
      await seedAsset('young', 1_000);
      await runSweep('startup'); // assetCount = 1, count still 1

      expect(await isPeriodicSweepWarranted()).toBe(false);
   });
});
