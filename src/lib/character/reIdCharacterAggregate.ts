// -- Library Imports --
import cuid from 'cuid';

// -- Utils Imports --
import { deepReId } from '@/lib/utils/drawer';

// -- Type Imports --
import type { Card, Character } from '@/lib/types/character';
import type { Journal } from '@/lib/types/board';

/*
 * Cross-reference-safe re-identification of a character aggregate, for importing or forking a character
 * as a fresh, independent copy. The generic `deepReId` is WRONG here: it remints every `id` field
 * independently and so breaks two cross-references a character actually carries.
 *   - `sheetLayout[].id` names a `cards[].id` / `journals[].id`. Blindly reminting both sides desyncs the
 *     manifest, and `resolveSheetLayout` then self-heals by dropping the dead entries and re-appending
 *     cards-then-journals - silently discarding the user's ordering.
 *   - A journal's `bookmarks[].pageId` names a `pages[].id`. Reminting the pages while leaving `pageId`
 *     (a differently-named field) untouched orphans every bookmark.
 * So this builds one old->new id map over the top-level cards and journals, remints those ids and remaps
 * the manifest through the same map, and keeps each journal's pages and bookmarks verbatim (reminting only
 * the top-level journal id, the same shape a journal import uses). Nested value-object ids (tags, tracker
 * ids, challenge statuses/abilities, fellowship/crew members) carry no cross-references, so those ARE
 * reminted fresh via `deepReId` for a truly independent copy. Asset ids (`ImageCardDetails.assetId`,
 * `LegendsChallengeDetails.assetId`) are content-hash keys into the assets store, not entity ids, and a
 * differently-named field, so they ride through untouched.
 */

/**
 * Returns a deep-enough clone of `character` with a fresh character id, fresh card and journal ids (with the
 * sheet-layout manifest remapped to match), fresh nested value-object ids, and each journal's pages and
 * bookmarks preserved. `drawerItemId` is cleared so an imported copy can't stale-link and later overwrite an
 * unrelated drawer item on Save; the fork caller sets the new drawer item id afterwards. The input is left
 * unmodified.
 *
 * @param character - The source character aggregate.
 * @returns A new aggregate with independent identity.
 */
export function reIdCharacterAggregate(character: Character): Character {
   const idMap = new Map<string, string>();
   for (const card of character.cards) idMap.set(card.id, cuid());
   for (const journal of character.journals) idMap.set(journal.id, cuid());

   // Cards: remint the nested value-object ids fresh (deepReId), but take the top-level id from the map so the
   // manifest stays consistent. `assetId` is a differently-named field, so deepReId leaves it verbatim.
   const cards: Card[] = character.cards.map((card) => ({ ...deepReId(card), id: idMap.get(card.id)! }));

   // Journals: remint only the top-level id; pages and their bookmarks stay verbatim so bookmark->page holds.
   const journals: Journal[] = character.journals.map((journal) => ({ ...structuredClone(journal), id: idMap.get(journal.id)! }));

   // Manifest: remap each entry through the same card/journal map, preserving kind and order.
   const sheetLayout = character.sheetLayout.map((entry) => ({ ...entry, id: idMap.get(entry.id) ?? entry.id }));

   return {
      ...character,
      id: cuid(),
      drawerItemId: undefined,
      cards,
      journals,
      sheetLayout,
      trackers: deepReId(character.trackers),
   };
}
