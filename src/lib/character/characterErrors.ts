/**
 * Typed errors thrown by the character data layer.
 *
 * Mirrors the drawer's `drawerErrors.ts` convention: the repository throws and
 * never swallows; it has no UI concerns. The store layer that wraps it is the
 * single place that catches these and surfaces them. Each error carries a stable
 * `code` so callers can branch without string-matching messages.
 */

/** A character referenced by id does not exist. */
export class CharacterNotFoundError extends Error {
   readonly code = 'CHARACTER_NOT_FOUND';
   constructor(message: string) {
      super(message);
      this.name = 'CharacterNotFoundError';
   }
}

/**
 * A Dexie/IndexedDB character transaction failed and was rolled back. Wraps the
 * underlying cause so the original failure is not lost.
 */
export class CharacterRepositoryError extends Error {
   readonly code = 'CHARACTER_REPOSITORY_FAILED';
   constructor(message: string, options?: { cause?: unknown }) {
      super(message, options);
      this.name = 'CharacterRepositoryError';
   }
}
