// -- Constant Imports --
import { DEFAULT_IMAGE_CARD_SIZE, clampCardWidth, clampCardHeight } from '@/lib/constants/imageCard';

// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';
import type { CardBoardContent, TrackerBoardContent, ImageBoardContent, CharacterBoardContent } from '@/lib/types/board';
import type { Character, ImageCardDetails } from '@/lib/types/character';

/*
 * Turns a dragged drawer card/tracker into the spec for a board item. A card/tracker drops as a
 * COPY: the content is deep-copied so the board item is self-contained and a later drawer edit can
 * never mutate it, and it records `sourceDrawerItemId`. An IMAGE_CARD is just an image, so it drops
 * as the board's NATIVE image item (no embed, no copy/reference). Full sheets, full boards, and
 * folders are not droppable here and return `null` (the caller no-ops without a toast).
 */

/**
 * Native footprint (world units) of each tracker, matching the sheet component's fixed size, so the
 * embed box hugs the tracker (it carries its own border - the box stays bare). A status is `w-55 h-25`,
 * a story tag `w-55 h-13.75`, a story theme `w-62.5 h-55` (rem -> px at 16px/rem).
 */
export const EMBEDDED_TRACKER_SIZES: Record<string, { width: number; height: number }> = {
   STATUS: { width: 220, height: 100 },
   STORY_TAG: { width: 220, height: 55 },
   STORY_THEME: { width: 250, height: 220 },
};
/** Fallback when a tracker's type is unknown. */
const DEFAULT_TRACKER_SIZE = { width: 220, height: 100 } as const;

/** Native footprint of a theme / character card (the sheet's `w-62.5 h-150`); the embed renders at this size. */
export const EMBEDDED_CARD_SIZE = { width: 250, height: 600 } as const;

/** Default footprint of a character reference element. Wide enough that a theme row's type + themebook stay readable; the overview grows the height to fit its rows. */
export const CHARACTER_ELEMENT_SIZE = { width: 360, height: 132 } as const;

// An IMAGE_CARD is NOT here: it drops as a native image item, not an embedded card.
const CARD_TYPES = new Set<GeneralItemType>(['CHARACTER_CARD', 'CHARACTER_THEME', 'GROUP_THEME', 'LOADOUT_THEME']);
const TRACKER_TYPES = new Set<GeneralItemType>(['STATUS_TRACKER', 'STORY_TAG_TRACKER', 'STORY_THEME_TRACKER']);

/** The native footprint for an embedded tracker, by its `trackerType`. */
function trackerEmbedSize(item: DrawerItem): { width: number; height: number } {
   const trackerType = (item.content as { trackerType?: string }).trackerType;
   return (trackerType && EMBEDDED_TRACKER_SIZES[trackerType]) || DEFAULT_TRACKER_SIZE;
}

/** The spec for a board item built from a drawer item: its kind, default size, and content. */
export interface EmbeddedBoardSpec {
   kind: 'card' | 'tracker' | 'image' | 'character';
   width: number;
   height: number;
   content: CardBoardContent | TrackerBoardContent | ImageBoardContent | CharacterBoardContent;
}

/**
 * The character reference element for a character dragged from a TAB onto the board, or `null` when
 * the character is unsaved (no `drawerItemId`) - the element is a drawer reference, so an unsaved
 * character can't make one (the caller prompts to save first).
 */
export function characterElementSpec(character: { id: string; drawerItemId?: string } | null): EmbeddedBoardSpec | null {
   const sourceDrawerItemId = character?.drawerItemId;
   if (!character || !sourceDrawerItemId) return null;
   return {
      kind: 'character',
      width: CHARACTER_ELEMENT_SIZE.width,
      height: CHARACTER_ELEMENT_SIZE.height,
      content: { kind: 'character', sourceDrawerItemId, characterId: character.id },
   };
}

/**
 * Builds the board-item spec for `item`, or `null` when the item is not droppable. A card/tracker
 * becomes an embedded COPY (deep-copied content, recording the source id); an image card becomes a
 * native image item; a saved full character sheet becomes a live read-only character REFERENCE.
 */
export function embeddedSpecForDrawerItem(item: DrawerItem): EmbeddedBoardSpec | null {
   if (item.type === 'FULL_CHARACTER_SHEET') {
      // A FULL_CHARACTER_SHEET's content is the Character; its id keys the open-tab lookup.
      const characterId = (item.content as Character).id;
      return {
         kind: 'character',
         width: CHARACTER_ELEMENT_SIZE.width,
         height: CHARACTER_ELEMENT_SIZE.height,
         content: { kind: 'character', sourceDrawerItemId: item.id, characterId },
      };
   }
   if (item.type === 'IMAGE_CARD') {
      const details = (item.content as { details?: ImageCardDetails }).details;
      return {
         kind: 'image',
         width: details?.width ? clampCardWidth(details.width) : DEFAULT_IMAGE_CARD_SIZE.width,
         height: details?.height ? clampCardHeight(details.height) : DEFAULT_IMAGE_CARD_SIZE.height,
         content: { kind: 'image', assetId: details?.assetId ?? null, fit: details?.fit ?? 'cover' },
      };
   }
   if (CARD_TYPES.has(item.type)) {
      return {
         kind: 'card',
         width: EMBEDDED_CARD_SIZE.width,
         height: EMBEDDED_CARD_SIZE.height,
         content: { kind: 'card', mode: 'copy', sourceDrawerItemId: item.id, data: structuredClone(item.content) },
      };
   }
   if (TRACKER_TYPES.has(item.type)) {
      const size = trackerEmbedSize(item);
      return {
         kind: 'tracker',
         width: size.width,
         height: size.height,
         content: { kind: 'tracker', mode: 'copy', sourceDrawerItemId: item.id, data: structuredClone(item.content) },
      };
   }
   return null;
}
