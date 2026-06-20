// -- Local Imports --
import { ACTIVE_CHARACTER_ID_KEY } from './characterSession';

// -- Type Imports --
import type { OpenTab } from './tabManagerStore';

/**
 * Workspace session pointer. Replaces the single-id
 * `ACTIVE_CHARACTER_ID_KEY` with the full set of open desktop tabs plus the active
 * one, persisted as a small JSON blob in `localStorage` (the character *data* still
 * lives in IndexedDB). Read synchronously before first paint so boot knows what to
 * restore. This is a localStorage shape bump only, no IndexedDB change.
 */

/** localStorage key holding the serialized {@link Workspace}. */
export const WORKSPACE_KEY = 'characters-of-the-mist_workspace';

/** The persisted desktop workspace: the open tabs in order, plus the active tab id. */
export interface Workspace {
   /** Open tabs in tab order. */
   openTabs: OpenTab[];
   /** The active tab id, or `null` when at the menu. */
   activeId: string | null;
}

const EMPTY_WORKSPACE: Workspace = { openTabs: [], activeId: null };

/**
 * Reads the workspace. When the workspace key is absent but the legacy single-id
 * pointer (`ACTIVE_CHARACTER_ID_KEY`) exists, seeds a one-tab workspace from it,
 * writes that through, and removes the old key (backward-safe migration of the
 * localStorage shape). Returns an empty workspace on a fresh install or any parse
 * failure.
 *
 * @returns The current workspace (never throws).
 */
export function readWorkspace(): Workspace {
   try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (raw !== null) {
         const parsed = JSON.parse(raw) as Partial<Workspace> | null;
         if (parsed && Array.isArray(parsed.openTabs)) {
            return { openTabs: parsed.openTabs, activeId: parsed.activeId ?? null };
         }
         return EMPTY_WORKSPACE;
      }

      // Backward seed: convert a lone legacy single-id pointer into a one-tab workspace.
      const legacyActiveId = localStorage.getItem(ACTIVE_CHARACTER_ID_KEY);
      if (legacyActiveId) {
         const seeded: Workspace = {
            openTabs: [{ id: legacyActiveId, type: 'character' }],
            activeId: legacyActiveId,
         };
         writeWorkspace(seeded);
         localStorage.removeItem(ACTIVE_CHARACTER_ID_KEY);
         return seeded;
      }

      return EMPTY_WORKSPACE;
   } catch {
      return EMPTY_WORKSPACE;
   }
}

/** Persists the workspace. No-op if localStorage is unavailable. */
export function writeWorkspace(workspace: Workspace): void {
   try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
   } catch {
      // localStorage unavailable (e.g. privacy mode): nothing to persist.
   }
}

/** Removes the workspace entirely (used by the reset-app data path). */
export function clearWorkspace(): void {
   try {
      localStorage.removeItem(WORKSPACE_KEY);
   } catch {
      // nothing to clear
   }
}
