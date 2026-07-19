/*
 * Persistent list of recently-used CUSTOM colors - the ones picked through the full color
 * picker, not a curated palette swatch. Capped, deduped, most-recent-first, and stored in
 * localStorage so the list survives reloads. Ported from the sibling Documinter app and
 * collapsed from its two (font/highlight) lists to one, since a board needs a single list.
 */

/** localStorage key holding the recent-colors list. */
export const RECENT_COLORS_KEY = 'characters-of-the-mist_recent-colors';
const STORAGE_KEY = RECENT_COLORS_KEY;
const MAX_RECENTS = 9;

/** True when value is an array of strings (defensive parse guard). */
function isStringArray(value: unknown): value is string[] {
   return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** Reads the recent-colors list, returning an empty list when absent, malformed, or storage is unavailable. */
export function readRecentColors(): string[] {
   try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return isStringArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
   } catch {
      return [];
   }
}

/**
 * Pushes a color to the front of the list (dedupe, move-to-front, cap at MAX_RECENTS),
 * persists the result, and returns the updated list. The hex is lowercased so dedupe stays
 * consistent.
 */
export function pushRecentColor(hex: string): string[] {
   const normalized = hex.toLowerCase();
   const withoutDuplicate = readRecentColors().filter((entry) => entry.toLowerCase() !== normalized);
   const next = [normalized, ...withoutDuplicate].slice(0, MAX_RECENTS);
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
   } catch {
      // Storage unavailable (private mode / quota); keep the in-memory result anyway.
   }
   return next;
}
