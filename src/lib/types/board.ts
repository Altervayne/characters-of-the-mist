/*
 * The Board aggregate types (the assembled form), analogous to the drawer's
 * `Folder`/`DrawerItem`. The normalized persistence shapes live in
 * `src/lib/board/boardRecords.ts`; the repository assembles these from records.
 *
 * The per-kind `content` payloads are deliberately MINIMAL for now - just enough to
 * persist and test. Each consumer prompt finalizes its own kind's payload, so these
 * shapes are expected to grow (flagged inline where so).
 */

// -- Type Imports --
import type { DiceTrayContent } from '@/lib/dice/diceTrayTypes';

/** Board camera: pan offset + zoom. Persisted; a return-to-origin control resets it. */
export interface Viewport {
   x: number;
   y: number;
   zoom: number;
}

/** The background grid styles a board can show behind its items. */
export type BoardGridType = 'dots' | 'lines' | 'none';

/**
 * A board's background grid. `color` is optional - absent means a subtle theme default;
 * full color customization rides the ported color picker later.
 */
export interface BoardGrid {
   type: BoardGridType;
   color?: string;
}

/** The kinds of item a board can hold. `connection` is a non-spatial line between two items. */
export type BoardItemKind = 'image' | 'post-it' | 'journal' | 'threat' | 'card' | 'tracker' | 'connection' | 'pin' | 'dice-tray' | 'zone' | 'character';

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
   /** Background color (hex). Absent on notes created before colors existed - defaulted to amber on read. */
   color?: string;
}

/** One journal page: a stable id (so bookmarks reference it, not an index) and its text. */
export interface JournalPage {
   id: string;
   text: string;
}

/** A bookmark on a journal: references a page by id and an optional tab label. */
export interface JournalBookmark {
   id: string;
   pageId: string;
   label?: string;
}

/** Paged notes with id'd pages and bookmarks (side tabs that jump to a page). */
export interface JournalBoardContent {
   kind: 'journal';
   pages: JournalPage[];
   bookmarks: JournalBookmark[];
}

/**
 * An embedded character card or tracker, in the reference-vs-copy model. A `copy` is a
 * self-contained snapshot in `data`; a `reference` is a
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

/**
 * A live, read-only mirror of a character (`FULL_CHARACTER_SHEET`). Reference-only - editing is the
 * character tab's job - so there is no copy variant. `characterId` is the primary key (tabs are keyed
 * by it): when the character is open in a tab the element shows that LIVE instance, so unsaved edits
 * show - this works for a saved AND an unsaved character. When it is closed it falls back to the saved
 * drawer entry (`sourceDrawerItemId`), which is OPTIONAL: an unsaved character has none, so a closed
 * one with no source reads as "removed without being saved". `lastKnown` caches the last successful
 * read so a dangling element (closed + source deleted) can still show its name.
 */
export interface CharacterBoardContent {
   kind: 'character';
   /** The referenced character's id, keying the open-tab lookup for the live-or-saved choice. Always set. */
   characterId: string;
   /** The saved drawer item's id, when the character is saved; absent for an unsaved (tab-only) character. */
   sourceDrawerItemId?: string;
   lastKnown?: unknown;
}

/** A small corkboard pin: a freestanding dot, mainly an anchor to connect lines to/from. */
export interface PinBoardContent {
   kind: 'pin';
   /** Dot color (hex). */
   color: string;
}

// The dice-tray data shapes now live in the board-agnostic dice home (a second consumer is coming);
// re-exported here so existing `@/lib/types/board` importers keep working.
export type { DieSides, DiceTrayDie, DiceTrayModifier } from '@/lib/dice/diceTrayTypes';

/**
 * The board's dice tray: the board-agnostic {@link DiceTrayContent} (dice / modifiers / title / cached
 * lastRoll) plus the board item `kind` tag. The CONFIG is undoable; the `lastRoll` is the CACHED last
 * result, written via the non-undoable cache path so it survives reload + save/export without ever
 * landing on the undo stack or spamming the board with commands. The board adds nothing beyond the tray.
 */
export type DiceTrayBoardContent = DiceTrayContent & { kind: 'dice-tray' };

/**
 * A labeled, resizable background frame that groups items (a Figma-style zone). Renders BEHIND
 * its members; its rectangle is the item's x/y/w/h. Membership + move-with-contents + collapse
 * are later prompts - this is the frame. `color` is an optional hex tint (default a subtle theme
 * tint); `collapsed` is reserved for the later collapse toggle.
 */
export interface ZoneBoardContent {
   kind: 'zone';
   label?: string;
   color?: string;
   collapsed: boolean;
}

/** A connection's line dash pattern. Optional on the style - absent reads as `solid` (back-compat). */
export type ConnectionDash = 'solid' | 'dashed' | 'dotted';

/** A connection's visual style: stroke width + color, plus an optional dash pattern. */
export interface ConnectionStyle {
   width: number;
   color: string;
   dash?: ConnectionDash;
}

/** A user-styled line between two board items (endpoints are board-item ids). */
export interface ConnectionBoardContent {
   kind: 'connection';
   from: string;
   to: string;
   style: ConnectionStyle;
}

/**
 * Stub for the Mist Engine Threat construct. Deliberately unmodelled here: it has
 * real game structure and gets its own research pass.
 * Kept in the union only so the kind is representable.
 */
export interface ThreatBoardContent {
   kind: 'threat';
   // TODO: model the Threat's name / tags / might / consequences here.
}

/** A board item's payload, discriminated by `kind` (mirrors the item's own `kind`). */
export type BoardItemContent =
   | ImageBoardContent
   | PostItBoardContent
   | JournalBoardContent
   | CardBoardContent
   | TrackerBoardContent
   | ConnectionBoardContent
   | ThreatBoardContent
   | PinBoardContent
   | DiceTrayBoardContent
   | ZoneBoardContent
   | CharacterBoardContent;

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
   /** The zone this item is a member of (set when it lands inside one), or absent when in no zone. */
   zoneId?: string;
   content: BoardItemContent;
}

/** An assembled board: its metadata, persisted viewport, and z-ordered items. */
export interface Board {
   id: string;
   name: string;
   viewport: Viewport;
   /** The drawer `FULL_BOARD` item this board is saved to, or null/absent when unsaved (mirrors `character.drawerItemId`). */
   drawerItemId?: string | null;
   /** Background grid style. Absent on boards created before grids existed - defaulted on read. */
   grid?: BoardGrid;
   items: BoardItem[];
}
