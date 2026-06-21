// -- Local Imports --
import { listCharacters } from '@/lib/character/characterRepository';
import { listAllItemContents } from '@/lib/drawer/drawerRepository';

// -- Type Imports --
import type { Card, Character } from '@/lib/types/character';
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * The "mark" side of asset garbage collection: walks every place an asset id can
 * appear and returns the set of referenced hashes. Sources its data through the
 * repositories (never raw `db`), so a new reference domain (e.g. the Board) registers
 * its read + extractor here, in one place.
 *
 * A reference is any card's `details.assetId` that is a non-null string. It is a
 * pure presence check, NOT gated on `cardType`: the `IMAGE_CARD` type does not exist
 * yet, so this matches nothing today, and lights up automatically once cards start
 * carrying an `assetId` - the consumer series needs no change here.
 */

/** Adds a card's `details.assetId` to `into` when present. Forward-compatible: the field need not exist yet. */
function collectFromCard(card: Card, into: Set<string>): void {
   const assetId = (card.details as { assetId?: unknown }).assetId;
   if (typeof assetId === 'string' && assetId.length > 0) into.add(assetId);
}

/** Walks every card on a character. */
function collectFromCharacter(character: Character, into: Set<string>): void {
   for (const card of character.cards) collectFromCard(card, into);
}

/** A drawer item's content is a character (has `cards`), a card (has `details`), or a tracker (neither). */
function collectFromItemContent(content: DrawerItemContent, into: Set<string>): void {
   if (Array.isArray((content as Character).cards)) {
      collectFromCharacter(content as Character, into);
   } else if ('details' in content) {
      collectFromCard(content as Card, into);
   }
   // Trackers hold no asset references.
}

/**
 * Collects every asset hash currently referenced anywhere in stored data: every
 * character's cards, and every drawer item whose content is a card or a character.
 *
 * @returns The set of referenced hashes. Anything in the asset store NOT in this
 *   set is an orphan candidate for the sweep (subject to the grace window).
 */
export async function collectReferencedAssetHashes(): Promise<Set<string>> {
   const referenced = new Set<string>();

   const [characterRecords, itemContents] = await Promise.all([
      listCharacters(),
      listAllItemContents(),
   ]);

   for (const record of characterRecords) collectFromCharacter(record.character, referenced);
   for (const content of itemContents) collectFromItemContent(content, referenced);

   return referenced;
}
