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

/** Default footprint (world units) for an embedded tracker. */
export const EMBEDDED_TRACKER_SIZE = { width: 264, height: 152 } as const;

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
      return {
         kind: 'tracker',
         width: EMBEDDED_TRACKER_SIZE.width,
         height: EMBEDDED_TRACKER_SIZE.height,
         content: { kind: 'tracker', mode: 'copy', sourceDrawerItemId: item.id, data: structuredClone(item.content) },
      };
   }
   return null;
}
