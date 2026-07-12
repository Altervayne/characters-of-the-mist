// -- Type Imports --
import type { TabType } from './tabManagerStore';

/*
 * The portal-trail JOURNEY: a pure, in-memory back-stack of portal navigations, layered on the tab system (it
 * complements the tab strip's random access, it does not duplicate it). This module is the PURE state machine -
 * no store, DOM, or async - so it is fully unit-testable; `tabManagerStore` holds the slice and wraps these
 * reducers in its actions, and the floating pill renders the derived view.
 *
 * The model is a LITERAL browser history: `entries` in visited order (repeats allowed - A->B->A = [A, B, A]) and
 * a `currentIndex` marker. A portal-follow is the ONLY growth path; a manual tab switch NEVER mutates it (the
 * marker's follow-the-active-tab is DERIVED for rendering via {@link deriveCurrentIndex}, never a stored write -
 * so the trail stays the deliberate portal thread, paused-but-intact when you wander off it via the tab strip).
 */

/** One stop on the trail: enough to reopen the target by id, plus a snapshot name for the crumb. */
export interface JourneyEntry {
   /** The target tab's kind (matches the tab manager's tab identity). */
   tabKind: TabType;
   /** The target entity's id (tabs dedupe by entity id, so this keys the tab too). */
   entityId: string;
   /** The crumb's display name, snapshot at push time (the resolved target name, else its caption). */
   name: string;
}

/** The journey slice: the ordered trail plus the marker (`-1` when empty). */
export interface JourneySlice {
   entries: JourneyEntry[];
   currentIndex: number;
}

/** The empty trail (no dive in progress). */
export const EMPTY_JOURNEY: JourneySlice = { entries: [], currentIndex: -1 };

/**
 * Records a portal edge `from -> to` - the ONLY growth path. Literal browser history:
 *  - a `from === to` self-edge (a portal onto the tab you are already on) is a no-op;
 *  - an empty trail, or a marker whose entry is not `from` (you portalled from somewhere off the marker), SEEDS a
 *    fresh `[from, to]` (a new dive begins);
 *  - otherwise the forward entries are truncated and `to` is appended (following a portal discards any forward
 *    history, exactly like a browser).
 * The marker always lands on `to` (the top of the new trail).
 */
export function pushJourney(slice: JourneySlice, from: JourneyEntry, to: JourneyEntry): JourneySlice {
   if (from.entityId === to.entityId) return slice; // self-edge: no navigation happened.

   const current = slice.entries[slice.currentIndex];
   if (!current || current.entityId !== from.entityId) {
      return { entries: [from, to], currentIndex: 1 };
   }

   const kept = slice.entries.slice(0, slice.currentIndex + 1);
   const entries = [...kept, to];
   return { entries, currentIndex: entries.length - 1 };
}

/** The result of a marker move: the updated slice and the entry the caller should (re)activate (`null` if empty). */
export interface JourneyMove {
   slice: JourneySlice;
   entry: JourneyEntry | null;
}

/** Moves the marker to `index` (clamped into range) and returns the entry there. A no-op on an empty trail. */
export function goToJourneyIndex(slice: JourneySlice, index: number): JourneyMove {
   if (slice.entries.length === 0) return { slice, entry: null };
   const clamped = Math.max(0, Math.min(index, slice.entries.length - 1));
   return { slice: { entries: slice.entries, currentIndex: clamped }, entry: slice.entries[clamped] };
}

/** Steps the marker one back (clamped) and returns the entry to reactivate. */
export function journeyBack(slice: JourneySlice): JourneyMove {
   return goToJourneyIndex(slice, slice.currentIndex - 1);
}

/** Steps the marker one forward (clamped) and returns the entry to reactivate (forward crumbs are reachable). */
export function journeyForward(slice: JourneySlice): JourneyMove {
   return goToJourneyIndex(slice, slice.currentIndex + 1);
}

/**
 * Drops every entry for a dead `entityId` (a closed AND never-saved target, detected at pop) and repoints the
 * marker at the nearest surviving entry at or before the old marker (else the new head). Empties the trail when
 * nothing survives.
 */
export function dropJourneyEntry(slice: JourneySlice, entityId: string): JourneySlice {
   const entries: JourneyEntry[] = [];
   let currentIndex = -1;
   slice.entries.forEach((entry, index) => {
      if (entry.entityId === entityId) return; // drop
      entries.push(entry);
      if (index <= slice.currentIndex) currentIndex = entries.length - 1; // last survivor at/before the old marker
   });
   if (entries.length === 0) return EMPTY_JOURNEY;
   return { entries, currentIndex: currentIndex === -1 ? 0 : currentIndex };
}

/**
 * Rewrites every entry for `oldId` to `newId`, preserving the marker. Used when a tab adopts a fresh identity
 * (Save-As fork): the trail is ephemeral, but the just-forked tab is now the active one, so re-keying its crumb
 * keeps it ON-trail (the marker follows the active tab) rather than stranding a crumb that would reopen the
 * untouched original. Returns the same slice reference when `oldId` never appears (no churn).
 */
export function rekeyJourneyEntity(slice: JourneySlice, oldId: string, newId: string): JourneySlice {
   if (oldId === newId) return slice;
   let changed = false;
   const entries = slice.entries.map((entry) => {
      if (entry.entityId !== oldId) return entry;
      changed = true;
      return { ...entry, entityId: newId };
   });
   return changed ? { entries, currentIndex: slice.currentIndex } : slice;
}

/**
 * The DERIVED current crumb for a given active tab - the rendering rule for the owner-locked "intact-but-paused"
 * manual switch: if the active tab matches a trail entry it is the current crumb (highlighted, the marker
 * follows it), choosing the entry nearest the stored marker to disambiguate repeats; if the active tab is
 * off-trail the trail is PAUSED (`null` - no crumb highlighted). Never mutates the slice.
 */
export function deriveCurrentIndex(slice: JourneySlice, activeTabId: string | null): number | null {
   if (activeTabId === null) return null;
   let best: number | null = null;
   slice.entries.forEach((entry, index) => {
      if (entry.entityId !== activeTabId) return;
      if (best === null || Math.abs(index - slice.currentIndex) < Math.abs(best - slice.currentIndex)) {
         best = index;
      }
   });
   return best;
}
