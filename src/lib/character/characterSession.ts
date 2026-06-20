/**
 * Active-character session pointer.
 *
 * The id of the character to reopen on boot lives in a tiny `localStorage` key -
 * read synchronously before first paint so the app knows what to load, while the
 * character data itself lives in IndexedDB. A short id is negligible against the
 * "characters contribute ~nothing to localStorage" goal. Kept out of the Dexie
 * repository so that layer stays purely Dexie.
 */

/** localStorage key holding the active character's id (or absent when none is open). */
export const ACTIVE_CHARACTER_ID_KEY = 'characters-of-the-mist_active-character-id';

/** Reads the active character id, or `null` when none is set / localStorage is unavailable. */
export function getActiveCharacterId(): string | null {
   try {
      return localStorage.getItem(ACTIVE_CHARACTER_ID_KEY);
   } catch {
      return null;
   }
}

/** Sets (or, with `null`, clears) the active character id. No-op if localStorage is unavailable. */
export function setActiveCharacterId(id: string | null): void {
   try {
      if (id === null) {
         localStorage.removeItem(ACTIVE_CHARACTER_ID_KEY);
      } else {
         localStorage.setItem(ACTIVE_CHARACTER_ID_KEY, id);
      }
   } catch {
      // localStorage unavailable (e.g. privacy mode): nothing to persist.
   }
}
