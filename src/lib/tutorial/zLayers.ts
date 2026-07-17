/**
 * Stacking band for the tutorial engine. Sits ABOVE the command palette and the
 * drag-morph cluster (both z-1000) so a step can spotlight or drive them, and below
 * the dev-preview hazard frame (9998) and the legacy-data boot gate (10000), which
 * must never coexist with a running tutorial. Centralized here so no arbitrary
 * z-index drifts out of the band.
 */
export const TUTORIAL_Z = {
   /** Dim veil + interaction blocker. */
   scrim: 1100,
   /** Spotlight halo ring. */
   ring: 1101,
   /**
    * Looping gesture-cue overlay. Co-planar with the ring but painted after the overlay, so it sits above
    * the halo while staying below the coach - the cue can never cover the coach text.
    */
   gestureCue: 1101,
   /** Coach-mark card. */
   coach: 1102,
   /**
    * No-dim interaction guard. A `scrim:'none'` step still blocks the app so a stray click can't derail it,
    * but this blocker sits BELOW the app's modal/popover layer (Radix dialogs + dropdowns at z-50) - so the
    * `Add...` menu or the card dialog the step needs stays reachable while everything beneath it is inert.
    */
   noDimBlock: 40,
} as const;
