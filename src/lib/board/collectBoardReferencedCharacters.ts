// -- Board Imports --
import { resolveReferencedDrawerItem } from './useReferencedDrawerItem';

// -- Character Imports --
import { getCharacterInstanceIds, getOrCreateInstance } from '@/lib/character/characterStoreRegistry';

// -- Type Imports --
import type { Board } from '@/lib/types/board';
import type { Character } from '@/lib/types/character';

/*
 * Resolves the full current Character behind a board's character elements so an export can carry the
 * data a bare `characterId` can't. A character element is a live read-only reference; on another
 * machine the id names nothing, so we embed the character itself and let the importer recreate it.
 */

/**
 * Walks `board.items` for character elements and resolves each unique referenced `characterId` to its
 * full Character, keyed by that id. Resolution order (authoritative first):
 *   1. the saved drawer source (`sourceDrawerItemId`), when the read is live;
 *   2. the live open-tab instance, for an unsaved (never-persisted) character - peeked only, never
 *      created, so a closed character is not materialized;
 *   3. the element's cached `lastKnown`.
 * An unresolvable reference is skipped: its element imports as a graceful dangling placeholder.
 * De-duped by `characterId` - one entry however many elements point at it.
 */
export async function collectBoardReferencedCharacters(board: Board): Promise<Record<string, Character>> {
   const resolved: Record<string, Character> = {};

   for (const item of board.items) {
      const content = item.content;
      if (content.kind !== 'character') continue;

      const { characterId, sourceDrawerItemId, lastKnown } = content;
      if (resolved[characterId]) continue; // already embedded via an earlier element

      // 1. The saved drawer item is the authoritative copy - the character as persisted.
      if (sourceDrawerItemId) {
         const source = await resolveReferencedDrawerItem(sourceDrawerItemId);
         if (source.status === 'live' && source.content) {
            resolved[characterId] = source.content as Character;
            continue;
         }
      }

      // 2. An open tab covers an unsaved character. Peek only via the instance-id list; never call
      //    getOrCreateInstance for an id it doesn't contain, or a phantom instance would be born.
      if (getCharacterInstanceIds().includes(characterId)) {
         const live = getOrCreateInstance(characterId).getState().character;
         if (live) {
            resolved[characterId] = live;
            continue;
         }
      }

      // 3. The element's own last read, when there's nothing better.
      if (lastKnown) resolved[characterId] = lastKnown as Character;
   }

   return resolved;
}
