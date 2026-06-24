// -- Constant Imports --
import { DEFAULT_IMAGE_CARD_SIZE, clampCardWidth, clampCardHeight } from '@/lib/constants/imageCard';

// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';
import type { CardBoardContent, TrackerBoardContent } from '@/lib/types/board';

/*
 * Turns a dragged drawer card/tracker into the spec for an embedded board item. The drop
 * defaults to a COPY: the content is deep-copied so the board item is self-contained and
 * a later drawer edit can never mutate it. It also records `sourceDrawerItemId` so the
 * copy can later be toggled into a live reference. Full sheets, full boards, and folders
 * are not embeddable here and return `null` (the caller no-ops without a toast).
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

const CARD_TYPES = new Set<GeneralItemType>(['CHARACTER_CARD', 'CHARACTER_THEME', 'GROUP_THEME', 'LOADOUT_THEME', 'IMAGE_CARD']);
const TRACKER_TYPES = new Set<GeneralItemType>(['STATUS_TRACKER', 'STORY_TAG_TRACKER', 'STORY_THEME_TRACKER']);

/**
 * The native footprint for an embedded card. Theme / character cards use the fixed sheet size; an
 * image card uses its own stored dimensions (clamped) so the box matches the portrait it renders.
 */
function cardEmbedSize(item: DrawerItem): { width: number; height: number } {
   if (item.type === 'IMAGE_CARD') {
      const details = (item.content as { details?: { width?: number; height?: number } }).details;
      return {
         width: details?.width ? clampCardWidth(details.width) : DEFAULT_IMAGE_CARD_SIZE.width,
         height: details?.height ? clampCardHeight(details.height) : DEFAULT_IMAGE_CARD_SIZE.height,
      };
   }
   return { width: EMBEDDED_CARD_SIZE.width, height: EMBEDDED_CARD_SIZE.height };
}

/** The native footprint for an embedded tracker, by its `trackerType`. */
function trackerEmbedSize(item: DrawerItem): { width: number; height: number } {
   const trackerType = (item.content as { trackerType?: string }).trackerType;
   return (trackerType && EMBEDDED_TRACKER_SIZES[trackerType]) || DEFAULT_TRACKER_SIZE;
}

/** The spec for an embedded board item built from a drawer item: its kind, default size, and copy content. */
export interface EmbeddedBoardSpec {
   kind: 'card' | 'tracker';
   width: number;
   height: number;
   content: CardBoardContent | TrackerBoardContent;
}

/**
 * Builds the embedded-item spec for `item`, or `null` when the item is not an
 * embeddable card/tracker. The content is a deep copy of the drawer item's content,
 * independent of the source, and records the source id so it can be toggled to a
 * reference later.
 */
export function embeddedSpecForDrawerItem(item: DrawerItem): EmbeddedBoardSpec | null {
   if (CARD_TYPES.has(item.type)) {
      const size = cardEmbedSize(item);
      return {
         kind: 'card',
         width: size.width,
         height: size.height,
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
