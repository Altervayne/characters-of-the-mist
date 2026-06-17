// -- Type Imports --
import type { Character } from '@/lib/types/character';
import type { GameSystem } from '@/lib/types/drawer';

/**
 * The per-record schema version for character rows, written to
 * `CharacterRecord.schemaVersion`. Tracks the Dexie `version(2)` `characters`
 * store declared in `drawerDatabase.ts`; bump it (with a Dexie version upgrade)
 * when the record shape itself changes. The character's own data is versioned
 * separately by `harmonizeData` via the `version` field inside `Character`.
 */
export const CHARACTER_SCHEMA_VERSION = 1;

/**
 * One row per character in the `characters` store (migration spec §1.3).
 *
 * The full {@link Character} aggregate is stored INLINE on `character` (cards and
 * trackers are not shredded into separate stores) - a character is always read
 * and written whole, mirroring the drawer's content-as-blob granularity.
 *
 * `name`, `game`, `drawerItemId`, and `updatedAt` are denormalized onto the row so
 * a future recents/tab list can render from metadata without deserializing every
 * character. They are derived from `character` on every save (see
 * `characterRepository.saveCharacter`) so they cannot drift from the source.
 */
export interface CharacterRecord {
   /** Primary key. Equals `character.id` (a stable cuid assigned at creation). */
   id: string;
   /** Denormalized from `character.name` - for list/recents/tab rendering without loading content. */
   name: string;
   /** Denormalized from `character.game` - for filtering / game badges. */
   game: GameSystem;
   /** Epoch milliseconds of the last save; drives recents/tab ordering and last-write-wins. */
   updatedAt: number;
   /** The linked drawer `FULL_CHARACTER_SHEET` item id, or `null` when unlinked. Denormalized from `character.drawerItemId` for the reverse-link index. */
   drawerItemId: string | null;
   /** Per-record schema marker for future record-shape migrations. */
   schemaVersion: number;
   /** The full character aggregate, stored inline. */
   character: Character;
}
