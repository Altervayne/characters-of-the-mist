// -- Type Imports --
import type { DrawerItem, GeneralItemType } from '@/lib/types/drawer';
import type { CardBoardContent, TrackerBoardContent } from '@/lib/types/board';

/*
 * Turns a dragged drawer card/tracker into the spec for an embedded board item. This
 * prompt does COPIES only: the dropped content is deep-copied so the board item is
 * self-contained and a later drawer edit can never mutate it (the live reference model
 * is a later prompt). Full sheets, full boards, and folders are not embeddable here and
 * return `null` (the caller no-ops without a toast).
 */

/** Default footprint (world units) for an embedded card/tracker, sized to hold its compact snapshot. */
export const EMBEDDED_CARD_SIZE = { width: 264, height: 152 } as const;
export const EMBEDDED_TRACKER_SIZE = { width: 264, height: 152 } as const;

const CARD_TYPES = new Set<GeneralItemType>(['CHARACTER_CARD', 'CHARACTER_THEME', 'GROUP_THEME', 'LOADOUT_THEME', 'IMAGE_CARD']);
const TRACKER_TYPES = new Set<GeneralItemType>(['STATUS_TRACKER', 'STORY_TAG_TRACKER', 'STORY_THEME_TRACKER']);

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
 * independent of the source.
 */
export function embeddedSpecForDrawerItem(item: DrawerItem): EmbeddedBoardSpec | null {
   if (CARD_TYPES.has(item.type)) {
      return {
         kind: 'card',
         width: EMBEDDED_CARD_SIZE.width,
         height: EMBEDDED_CARD_SIZE.height,
         content: { kind: 'card', mode: 'copy', data: structuredClone(item.content) },
      };
   }
   if (TRACKER_TYPES.has(item.type)) {
      return {
         kind: 'tracker',
         width: EMBEDDED_TRACKER_SIZE.width,
         height: EMBEDDED_TRACKER_SIZE.height,
         content: { kind: 'tracker', mode: 'copy', data: structuredClone(item.content) },
      };
   }
   return null;
}
