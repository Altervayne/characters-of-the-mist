// -- Other Library Imports --
import cuid from 'cuid';

// -- Data Layer Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Utils Imports --
import { mapItemToStorableInfo } from '@/lib/utils/dnd';

// -- Type Imports --
import type { Card, Tracker } from '@/lib/types/character';
import type { GameSystem, GeneralItemType } from '@/lib/types/drawer';

/*
 * Save-back for a board card/tracker COPY: a board embed edits its inner aggregate in place, so it
 * diverges from the drawer twin it came from. These helpers persist that inner aggregate to the drawer
 * library - write-back by id (Save), or mint a new item (Save As) - mirroring how a character sheet /
 * board Save to the drawer. Pure data/logic: no React, no toasts, no UI. Save is explicit only - the
 * caller decides when, never on unmount.
 */

/** The inner aggregate of a board card/tracker copy, normalized and ready to store, plus its drawer routing. */
export interface NormalizedBoardItemInner {
   /** The clean inner aggregate (deep-cloned, `isFlipped` zeroed) to write as the drawer item content. */
   content: Card | Tracker;
   /** The drawer game segment - `details.game` for a card, `NEUTRAL` for a (game-agnostic) tracker. */
   game: GameSystem;
   /** The drawer item type - the card's `cardType`, or the tracker's `*_TRACKER` type. */
   type: GeneralItemType;
}

/**
 * Casts a board copy's `content.data` (opaque `unknown`) to its inner `Card | Tracker`, deep-clones it,
 * and derives its drawer routing. THE single boundary for `content.data as Card | Tracker` - every
 * save-back path routes through here so the cast, the clone, and the normalization never fork.
 *
 * Normalization: a card is stored face-up (`isFlipped: false`) - the flip is a transient view state, and
 * persisting a face-down card would land one face-down in the library (mirrors the sheet->drawer drop).
 * Routing reuses {@link mapItemToStorableInfo}, the same card/tracker -> `{type, game}` mapping the drawer
 * drop keys off, so the round-trip is symmetric (a tracker is game-agnostic -> `NEUTRAL`).
 *
 * Returns `null` when the data is not a recognizable card/tracker (a defensive guard; a real board
 * card/tracker copy always maps).
 */
export function normalizeBoardItemInner(data: unknown): NormalizedBoardItemInner | null {
   const inner = structuredClone(data) as Card | Tracker;

   const storable = mapItemToStorableInfo(inner);
   if (!storable) return null;
   const [type, game] = storable;

   // A card is stored face-up; a tracker has no flip. `isFlipped` lives only on a card.
   if ('cardType' in inner) inner.isFlipped = false;

   return { content: inner, game, type };
}

/** Outcome of {@link saveBoardItemToLinkedDrawerItem}. */
export interface SaveBoardItemToDrawerResult {
   /**
    * `true` when the source drawer item still existed and its content was replaced; `false` when the
    * link is dangling (the source was deleted), so the caller should fall back to a "Save As". Never
    * silently eats an explicit Save.
    */
   linkedItemUpdated: boolean;
}

/**
 * Explicit "Save" of a board card/tracker copy: when the source drawer item still exists, replace its
 * content with the board copy's normalized inner aggregate (its name / parent / order untouched, matching
 * `updateItemContent`). Unlike the character save there is no cross-store transaction - a board item lives
 * in the board record either way, so there is only one drawer write.
 *
 * If the source is gone (dangling link) - or the inner data does not normalize - nothing is written and
 * `linkedItemUpdated: false` is returned so the caller routes to "Save As".
 */
export async function saveBoardItemToLinkedDrawerItem(
   sourceDrawerItemId: string,
   innerData: unknown,
): Promise<SaveBoardItemToDrawerResult> {
   const normalized = normalizeBoardItemInner(innerData);
   if (!normalized) return { linkedItemUpdated: false };

   const existingItem = await db.items.get(sourceDrawerItemId);
   if (!existingItem) return { linkedItemUpdated: false };

   await db.items.update(sourceDrawerItemId, { content: normalized.content, updatedAt: Date.now() });
   return { linkedItemUpdated: true };
}

/**
 * "Save As" of a board card/tracker copy: mint a fresh drawer item id, queue the normalized inner
 * aggregate as a pending drawer drop under that id (the naming window finalizes it), and return the new
 * id. The caller adopts that id onto the board item's `content.sourceDrawerItemId` so a later Save writes
 * back - that adopt step needs the board item context and is the caller's (a later phase's).
 *
 * Returns `null` when the inner data does not normalize (nothing is queued).
 */
export function saveBoardItemAsToDrawer(innerData: unknown, folderId?: string): string | null {
   const normalized = normalizeBoardItemInner(innerData);
   if (!normalized) return null;

   const id = cuid();
   const defaultName = 'title' in normalized.content ? normalized.content.title : normalized.content.name;

   useDrawerStore.getState().actions.initiateItemDrop({
      game: normalized.game,
      type: normalized.type,
      content: normalized.content,
      presetId: id,
      parentFolderId: folderId,
      defaultName: defaultName?.trim() ? defaultName : 'New Item',
   });

   return id;
}
