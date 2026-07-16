/*
 * Reserved ids for the tutorial engine's isolated demo content. A demo entity lives only in
 * memory and is discarded on tutorial exit, so its ids are fixed sentinels that can never
 * collide with a generated `cuid`. The shared prefix lets every registry lister and future
 * per-instance consumer skip demo ids with one predicate. This module is a pure leaf (no
 * store, no asset import) so the character registry can filter on it without a cycle.
 */

/** Common prefix on every reserved demo id; the branch key for skip-guards. */
export const DEMO_ID_PREFIX = '__tutorial_demo';

/** The demo character's id, doubling as its registry key (character id === registry key). */
export const DEMO_CHARACTER_ID = '__tutorial_demo_character__';

/** The demo board's id, doubling as its registry key AND the sentinel the in-memory repository backend claims. */
export const DEMO_BOARD_ID = '__tutorial_demo_board__';

/** The demo note's id, doubling as its registry key AND the sentinel the in-memory note backend claims. */
export const DEMO_NOTE_ID = '__tutorial_demo_note__';

/** The portal-graph entry board (The Sunken Vault): its registry key + the sentinel the board backend claims. */
export const DEMO_PORTAL_BOARD_ID = '__tutorial_demo_portal_board__';

/** The portal-graph note (Field Notes): its registry key + the sentinel the note backend claims. */
export const DEMO_PORTAL_NOTE_ID = '__tutorial_demo_portal_note__';

/** The portal-graph leaf board (The Deeper Vault): its registry key + the sentinel the board backend claims. */
export const DEMO_PORTAL_BOARD2_ID = '__tutorial_demo_portal_board2__';

/**
 * The demo portrait's stand-in asset id. NOT a content hash and never stored: the portrait
 * seam in `useAssetObjectUrl` short-circuits it to a bundled placeholder before any asset-store
 * read, so the demo shows a picture with zero Dexie access.
 */
export const DEMO_PORTRAIT_ASSET_ID = '__tutorial_demo_portrait__';

/** True for any reserved demo id (character, portrait, and future board/portal-graph ids). */
export function isDemoId(id: string): boolean {
   return id.startsWith(DEMO_ID_PREFIX);
}
