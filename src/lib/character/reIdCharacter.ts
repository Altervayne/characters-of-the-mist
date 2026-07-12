// -- Utils Imports --
import { deepReId } from '@/lib/utils/drawer';

// -- Type Imports --
import type { Character } from '@/lib/types/character';

/*
 * Re-identification of a character aggregate, for forking a saved character into an independent
 * copy (Save-As on an already-saved character). A character carries no id CROSS-references (its
 * ids are `id` fields, never referenced by a differently-named field the way a journal's bookmark
 * names a page by `pageId`), so the generic `deepReId` is correct and total here - it is exactly
 * what the drawer's `addItem` already runs on a FULL_CHARACTER_SHEET copy. This wraps it as a named
 * seam so the fork path has one testable entry point. The caller sets `drawerItemId` afterwards.
 */

/**
 * Returns a deep clone of `character` with a fresh top-level id and fresh nested ids (cards,
 * trackers, etc.), fully independent of the source. `drawerItemId` (a differently-named field)
 * rides through untouched; the fork caller overwrites it with the new drawer item id. The input
 * is left unmodified.
 *
 * @param character - The source character aggregate.
 * @returns A new aggregate with independent identity.
 */
export function reIdCharacter(character: Character): Character {
   return deepReId(character);
}
