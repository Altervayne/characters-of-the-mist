// -- Utils Imports --
import { harmonizeData } from '@/lib/harmonization';
import { APP_VERSION } from '@/lib/config';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { CHARACTER_SCHEMA_VERSION } from './characterRecords';
import { setActiveCharacterId } from './characterSession';

// -- Type Imports --
import type { CharacterRecord } from './characterRecords';
import type { Character } from '@/lib/types/character';

/*
 * One-time migration of the legacy localStorage active-character blob into the
 * per-character `characters` Dexie store (migration spec §6). Additive: the app
 * keeps reading the old store; this only writes the IndexedDB copy and guards
 * itself so it runs exactly once. Mirrors the drawer migration, including
 * migration-time faithfulness verification that gates eventual blob removal.
 */

/**
 * localStorage key of the legacy zustand-persist character blob (shape
 * `{ state: { character }, version }`). Exported so the later removal phase has a
 * single source of truth.
 *
 * TODO (deferred — a LATER release, NOT now): once the IndexedDB character store
 * is proven, remove this blob via the drawer's verified-confirm-export flow,
 * gated on `meta.characterLegacyBlobRetainedUntil`. It is intentionally RETAINED
 * for now as a read-only safety net; the migration is idempotent and never
 * re-imports it once `meta.characterMigrationStatus === 'completed'`.
 */
export const LEGACY_CHARACTER_STORAGE_KEY = 'characters-of-the-mist_character-storage';

/** The result of an attempted character migration run. */
export type CharacterMigrationOutcome = 'already-completed' | 'fresh-install' | 'migrated';

/** Thrown when the character migration cannot proceed/verify safely (fail closed). */
export class CharacterMigrationError extends Error {
   readonly code = 'CHARACTER_MIGRATION_FAILED';
   constructor(message: string) {
      super(message);
      this.name = 'CharacterMigrationError';
   }
}

/**
 * In-flight run shared across concurrent callers. React StrictMode invokes mount
 * effects twice; both calls receive this single promise rather than racing two
 * migrations. Reset once settled so a failed run can be retried on the next load.
 */
let inFlightMigration: Promise<CharacterMigrationOutcome> | null = null;

/** Narrows an unknown parsed value to the {@link Character} shape. */
function isCharacterShape(value: unknown): value is Character {
   return (
      !!value &&
      typeof value === 'object' &&
      typeof (value as Character).id === 'string' &&
      Array.isArray((value as Character).cards) &&
      typeof (value as Character).trackers === 'object' &&
      (value as Character).trackers !== null
   );
}

/** Strictly parses the legacy blob: a valid character, a null character (no active sheet), or corrupt. */
type LegacyCharacterParse = { ok: true; character: Character | null } | { ok: false };
function parseLegacyCharacterBlob(rawBlob: string): LegacyCharacterParse {
   try {
      const parsed = JSON.parse(rawBlob) as { state?: { character?: unknown } };
      const candidate = parsed?.state?.character;
      if (candidate === null || candidate === undefined) return { ok: true, character: null };
      if (isCharacterShape(candidate)) return { ok: true, character: candidate };
   } catch {
      // fall through to the failure result
   }
   return { ok: false };
}

/**
 * Synchronous, side-effect-free peek for the boot loading gate (spec §5, C-4):
 * does the legacy localStorage blob still hold a migratable active character?
 *
 * The active-character session pointer is the boot gate's primary signal, but on
 * the one-time pre-migration launch that pointer is not set yet (the migration
 * sets it). Without this check the gate would briefly flash the main menu before
 * the just-migrated character loads — alarming on the very release that moves a
 * user's only character. Returns `false` once the blob is gone or holds no active
 * character.
 */
export function legacyBlobHasMigratableCharacter(): boolean {
   let rawBlob: string | null;
   try {
      rawBlob = localStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY);
   } catch {
      return false;
   }
   if (rawBlob === null) return false;
   const parsed = parseLegacyCharacterBlob(rawBlob);
   return parsed.ok && parsed.character !== null;
}

/** Recursive structural equality: key-order-insensitive for objects, order-sensitive for arrays. */
function deepEqual(a: unknown, b: unknown): boolean {
   if (a === b) return true;
   if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;

   const aIsArray = Array.isArray(a);
   const bIsArray = Array.isArray(b);
   if (aIsArray !== bIsArray) return false;
   if (aIsArray && bIsArray) {
      if (a.length !== b.length) return false;
      return a.every((element, index) => deepEqual(element, b[index]));
   }

   const aObj = a as Record<string, unknown>;
   const bObj = b as Record<string, unknown>;
   const aKeys = Object.keys(aObj);
   const bKeys = Object.keys(bObj);
   if (aKeys.length !== bKeys.length) return false;
   return aKeys.every((key) => Object.prototype.hasOwnProperty.call(bObj, key) && deepEqual(aObj[key], bObj[key]));
}

/** Marks completion with no record written (fresh install / no active character / corrupt blob). */
async function markFreshInstall(): Promise<void> {
   await drawerDatabase.transaction('rw', drawerDatabase.meta, async () => {
      await drawerDatabase.meta.put({ key: 'characterMigrationStatus', value: 'completed' });
   });
}

/** The actual migration body. See {@link runCharacterMigrationIfNeeded} for the guarded entry point. */
async function performMigration(): Promise<CharacterMigrationOutcome> {
   // Fast path: already migrated (re-checked inside the write transaction below).
   const status = await drawerDatabase.meta.get('characterMigrationStatus');
   if (status?.value === 'completed') return 'already-completed';

   let rawBlob: string | null;
   try {
      rawBlob = localStorage.getItem(LEGACY_CHARACTER_STORAGE_KEY);
   } catch {
      rawBlob = null;
   }
   if (rawBlob === null) {
      await markFreshInstall();
      return 'fresh-install';
   }

   // A corrupt blob, or a blob persisted with no active character, has nothing to
   // migrate. Mark completed and move on; the blob is retained untouched, so a
   // corrupt blob never wedges startup and no data is destroyed.
   const parsed = parseLegacyCharacterBlob(rawBlob);
   if (!parsed.ok || parsed.character === null) {
      await markFreshInstall();
      return 'fresh-install';
   }

   // Parse + harmonize OUTSIDE the transaction (pure, no DB writes).
   const harmonizedCharacter = harmonizeData(parsed.character, 'FULL_CHARACTER_SHEET');
   const record: CharacterRecord = {
      id: harmonizedCharacter.id,
      name: harmonizedCharacter.name,
      game: harmonizedCharacter.game,
      updatedAt: Date.now(),
      drawerItemId: harmonizedCharacter.drawerItemId ?? null,
      schemaVersion: CHARACTER_SCHEMA_VERSION,
      character: harmonizedCharacter,
   };

   // Single atomic rw transaction over characters + meta (spec §6). On any throw
   // the whole thing rolls back: the flag stays unset and the legacy blob is never
   // touched, so the next load safely retries.
   await drawerDatabase.transaction('rw', drawerDatabase.characters, drawerDatabase.meta, async () => {
      const innerStatus = await drawerDatabase.meta.get('characterMigrationStatus');
      if (innerStatus?.value === 'completed') return;

      // Defense in depth: refuse to write into a non-empty store when the flag is
      // unset, rather than duplicating data.
      const existingCount = await drawerDatabase.characters.count();
      if (existingCount > 0) {
         throw new CharacterMigrationError(
            'Characters store is not empty but the migration flag is unset; aborting to avoid duplicating data.',
         );
      }

      await drawerDatabase.characters.add(record);
      await drawerDatabase.meta.bulkPut([
         { key: 'characterMigrationStatus', value: 'completed' },
         { key: 'characterLegacyBlobRetainedUntil', value: APP_VERSION },
      ]);
   });

   // Reopen to the migrated character on next boot (session pointer in localStorage).
   setActiveCharacterId(record.id);

   // Verify faithfulness now, the one moment Dexie is guaranteed to equal the
   // source: read the record back, harmonize-normalize it, and deep-compare to the
   // source. Record `characterMigrationVerified` ONLY on an exact match - the sole
   // gate for ever removing the legacy blob. On mismatch, leave it unset and fail
   // closed by throwing (the data is migrated and usable, the blob retained).
   const storedRecord = await drawerDatabase.characters.get(record.id);
   const reconstructed = storedRecord ? harmonizeData(storedRecord.character, 'FULL_CHARACTER_SHEET') : null;
   if (!reconstructed || !deepEqual(harmonizedCharacter, reconstructed)) {
      throw new CharacterMigrationError(
         'Migration verification failed: the stored character does not match the source; the legacy blob will be retained.',
      );
   }
   await drawerDatabase.meta.bulkPut([
      { key: 'characterMigrationVerified', value: true },
      { key: 'characterMigratedRecordCount', value: 1 },
   ]);

   return 'migrated';
}

/**
 * Migrates the legacy localStorage character blob into IndexedDB exactly once.
 *
 * Idempotent and concurrency-safe: gated on `meta.characterMigrationStatus` (with
 * a re-check and an empty-store assertion inside the write transaction), and
 * de-duplicated across concurrent/StrictMode invocations via a shared in-flight
 * promise. The whole write is atomic - a failure rolls back, leaves the flag unset
 * and the legacy blob untouched, and is safe to retry on the next load.
 *
 * @returns Which path ran: `'already-completed'`, `'fresh-install'`, or `'migrated'`.
 */
export function runCharacterMigrationIfNeeded(): Promise<CharacterMigrationOutcome> {
   if (!inFlightMigration) {
      inFlightMigration = performMigration().finally(() => {
         inFlightMigration = null;
      });
   }
   return inFlightMigration;
}
