/*
 * The Mist Engine status tier rule. `tiers` is six INDIVIDUAL boxes (index `i` = tier `i+1`), not a
 * cumulative bar. Applying `tier N` ticks box N; if it is already ticked, it bubbles up to the first
 * unticked box at or above N. When `N..6` are all ticked the status is maxed and nothing changes.
 * Pure - returns a NEW array, never mutates the input.
 */
export function applyStatusTier(tiers: boolean[], tier: number): boolean[] {
   const next = [...tiers];
   // Valid tiers are 1..length; anything outside is a no-op.
   if (tier < 1 || tier > next.length) return next;
   for (let index = tier - 1; index < next.length; index++) {
      if (!next[index]) {
         next[index] = true;
         return next;
      }
   }
   return next;
}
