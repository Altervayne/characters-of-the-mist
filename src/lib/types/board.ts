/*
 * The Board aggregate types (the assembled form), analogous to the drawer's
 * `Folder`/`DrawerItem`. The normalized persistence shapes live in
 * `src/lib/board/boardRecords.ts`; the repository assembles these from records.
 *
 * The per-kind `content` payloads are deliberately MINIMAL for now - just enough to
 * persist and test. Each consumer prompt finalizes its own kind's payload, so these
 * shapes are expected to grow (flagged inline where so).
 */

/** Board camera: pan offset + zoom. Persisted; a return-to-origin control resets it. */
export interface Viewport {
   x: number;
   y: number;
   zoom: number;
}

/** The kinds of item a board can hold. `connection` is a non-spatial line between two items. */
export type BoardItemKind = 'image' | 'post-it' | 'journal' | 'threat' | 'card' | 'tracker' | 'connection';

/** An image card on the board; reuses IMAGE_CARD semantics (references the shared asset store). */
export interface ImageBoardContent {
   kind: 'image';
   assetId: string | null;
   fit: 'cover' | 'contain';
}

/** A quick single-text sticky note. */
export interface PostItBoardContent {
   kind: 'post-it';
   text: string;
}

/** Paged notes. Minimal for now; richer structure lands with its consumer. */
export interface JournalBoardContent {
   kind: 'journal';
   pages: string[];
}

/**
 * An embedded character card or tracker, in the reference-vs-copy model
 * (board-spec §5.2). A `copy` is a self-contained snapshot in `data`; a `reference` is a
 * live, read-only mirror of a drawer item (rendered from the drawer on each read).
 *
 * Both carry the originating `sourceDrawerItemId` so an item can be toggled either way:
 * a copy can become a reference (needs a source), and a reference can detach to a copy.
 * The optional `lastKnown` caches a reference's last successful read so it can still
 * convert-to-copy once the source is gone (dangling). `data`/`lastKnown` are loosely
 * typed - they hold a serialized card/tracker aggregate.
 */
export type EmbeddedBoardContent<K extends 'card' | 'tracker'> =
   | { kind: K; mode: 'copy'; sourceDrawerItemId?: string; data: unknown }
   | { kind: K; mode: 'reference'; sourceDrawerItemId: string; lastKnown?: unknown };

export type CardBoardContent = EmbeddedBoardContent<'card'>;
export type TrackerBoardContent = EmbeddedBoardContent<'tracker'>;

/** A user-styled line between two board items (endpoints are board-item ids). */
export interface ConnectionBoardContent {
   kind: 'connection';
   from: string;
   to: string;
   style: { width: number; color: string };
}

/**
 * Stub for the Mist Engine Threat construct. Deliberately unmodelled here: it has
 * real game structure and gets its own sub-spec + research pass (board-spec §5.1).
 * Kept in the union only so the kind is representable.
 */
export interface ThreatBoardContent {
   kind: 'threat';
   // TODO: Threat sub-spec - model name / tags / might / consequences here.
}

/** A board item's payload, discriminated by `kind` (mirrors the item's own `kind`). */
export type BoardItemContent =
   | ImageBoardContent
   | PostItBoardContent
   | JournalBoardContent
   | CardBoardContent
   | TrackerBoardContent
   | ConnectionBoardContent
   | ThreatBoardContent;

/**
 * An assembled board item: world-space placement plus its kind-discriminated content.
 *
 * Connections ignore the placement fields (`x`/`y`/`width`/`height`/`rotation`) -
 * their geometry derives from their endpoints - so those are stored as zeros for a
 * `connection` item.
 */
export interface BoardItem {
   id: string;
   kind: BoardItemKind;
   x: number;
   y: number;
   width: number;
   height: number;
   z: number;
   rotation?: number;
   content: BoardItemContent;
}

/** An assembled board: its metadata, persisted viewport, and z-ordered items. */
export interface Board {
   id: string;
   name: string;
   viewport: Viewport;
   items: BoardItem[];
}
