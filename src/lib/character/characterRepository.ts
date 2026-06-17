// -- Library Imports --
import { type Table } from 'dexie';

// -- Local Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { CHARACTER_SCHEMA_VERSION } from './characterRecords';
import { CharacterNotFoundError, CharacterRepositoryError } from './characterErrors';

// -- Type Imports --
import type { CharacterRecord } from './characterRecords';
import type { Character } from '@/lib/types/character';

/*
 * Framework-agnostic data-access layer for per-character records (migration spec
 * §2). Pure persistence: no React, no zustand, no toasts, no console. One row per
 * character (the full character stored inline), keyed by `character.id`, so the
 * API is naturally per-character and multi-character-ready. Lives in the same
 * Dexie database as the drawer so a save-character-to-drawer can transact across
 * both stores; the active-character session pointer lives in `characterSession.ts`
 * (localStorage), keeping this module purely Dexie.
 */

/**
 * Runs `work` in a read/write transaction over `tables`. The domain error
 * {@link CharacterNotFoundError} propagates unchanged so callers can branch on it;
 * any other failure aborts the transaction (rolling back every write) and is
 * rethrown as a {@link CharacterRepositoryError} preserving the original cause.
 */
async function runWriteTransaction<T>(tables: Table[], work: () => Promise<T>): Promise<T> {
   try {
      return await db.transaction('rw', tables, work);
   } catch (error) {
      if (error instanceof CharacterNotFoundError) throw error;
      throw new CharacterRepositoryError(
         `Character write transaction failed: ${error instanceof Error ? error.message : 'unknown error'}`,
         { cause: error },
      );
   }
}

/** Derives the stored record (with denormalized metadata + a fresh `updatedAt`) from a character. */
function toCharacterRecord(character: Character): CharacterRecord {
   return {
      id: character.id,
      name: character.name,
      game: character.game,
      updatedAt: Date.now(),
      drawerItemId: character.drawerItemId ?? null,
      schemaVersion: CHARACTER_SCHEMA_VERSION,
      character,
   };
}

/** Loads a character record by id, or `undefined` if it does not exist. */
export function getCharacter(id: string): Promise<CharacterRecord | undefined> {
   return db.characters.get(id);
}

/**
 * Loads the character record linked to a drawer `FULL_CHARACTER_SHEET` item, via
 * the `drawerItemId` index (the reverse link). Returns `undefined` when no working
 * record is linked to that item.
 */
export function getCharacterByDrawerItemId(drawerItemId: string): Promise<CharacterRecord | undefined> {
   return db.characters.where('drawerItemId').equals(drawerItemId).first();
}

/** Lists all character records, most-recently-updated first (for a future recents / tab list). */
export function listCharacters(): Promise<CharacterRecord[]> {
   return db.characters.orderBy('updatedAt').reverse().toArray();
}

/**
 * Upserts a character. The row's `name`, `game`, `drawerItemId`, and `updatedAt`
 * are always derived from the supplied character, so the denormalized metadata can
 * never drift from the source. Returns the stored record.
 */
export function saveCharacter(character: Character): Promise<CharacterRecord> {
   return runWriteTransaction([db.characters], async () => {
      const record = toCharacterRecord(character);
      await db.characters.put(record);
      return record;
   });
}

/** Outcome of {@link saveCharacterToLinkedDrawerItem}. */
export interface SaveCharacterToDrawerResult {
   /**
    * `true` when the character's linked drawer item still existed and was updated;
    * `false` when there was no link, or the link was dangling (the item had been
    * deleted), so the caller should fall back to a "Save As" (new drawer item).
    */
   linkedItemUpdated: boolean;
}

/**
 * Explicit "Save Character" (spec §7): in ONE read/write transaction over both
 * `characters` and `items` (same database, the reason §1.1 keeps a single DB),
 * upsert the working record and, when the character is linked to a drawer
 * `FULL_CHARACTER_SHEET` item that still exists, update that item's content too.
 *
 * Atomicity is the point: the working copy and the named drawer save can never end
 * up out of step from a mid-write failure. The item's `content` is replaced
 * verbatim (its name/parent/order untouched), matching `updateItemContent`.
 *
 * If the link is dangling (item deleted), the working record is still saved and
 * `linkedItemUpdated: false` is returned so the caller can route to "Save As"
 * rather than silently no-op'ing the user's explicit save.
 */
export function saveCharacterToLinkedDrawerItem(character: Character): Promise<SaveCharacterToDrawerResult> {
   return runWriteTransaction([db.characters, db.items], async () => {
      await db.characters.put(toCharacterRecord(character));

      const drawerItemId = character.drawerItemId ?? null;
      if (drawerItemId) {
         const existingItem = await db.items.get(drawerItemId);
         if (existingItem) {
            await db.items.update(drawerItemId, { content: character });
            return { linkedItemUpdated: true };
         }
      }
      return { linkedItemUpdated: false };
   });
}

/** Deletes a character record. Idempotent: deleting an absent id is a no-op. */
export function deleteCharacter(id: string): Promise<void> {
   return runWriteTransaction([db.characters], async () => {
      await db.characters.delete(id);
   });
}

/**
 * Deletes all character records (powers "Reset app"). The `meta` store is
 * deliberately preserved so the migration flags survive and a retained legacy blob
 * is not re-imported.
 */
export function clearAllCharacterData(): Promise<void> {
   return runWriteTransaction([db.characters], async () => {
      await db.characters.clear();
   });
}
