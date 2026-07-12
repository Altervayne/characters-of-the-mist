// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { Board, BoardItem } from '@/lib/types/board';

/*
 * Connection-safe re-identification of a board aggregate, for importing a board file as a
 * fresh, independent copy. The generic `deepReId` is WRONG here: it remints every `id`
 * independently, so a `connection`'s `from`/`to` (which are item-id references, not `id`
 * fields) would no longer match the new ids of the items they point at. This builds one
 * old->new id map and rewrites the item ids, the connection endpoints, AND a `board-element`
 * portal target (all three name BOARD items) through it, so the lines and intra-board portals
 * still resolve. A reference's `sourceDrawerItemId`, a character element's `characterId`, and a
 * portal's `entity`/`element`/`external` targets are left untouched - they name a DRAWER item, a
 * character, or an entity/URL, not board items (a missing source dangles by design, board-10).
 * They ride the `...item`/`...item.content` spread, so they survive without special handling.
 */

/**
 * Returns a deep-enough clone of `board` with a fresh board id and fresh item ids,
 * connection endpoints remapped to the new ids. The drawer link is cleared: an imported
 * board is unsaved on this device until the user saves it.
 *
 * @param board - The aggregate parsed from an imported file.
 * @returns A new aggregate with independent identity; the input is left unmodified.
 */
export function reIdBoardAggregate(board: Board): Board {
   const idMap = new Map<string, string>();
   for (const item of board.items) idMap.set(item.id, cuid());

   const items: BoardItem[] = board.items.map((item) => {
      const id = idMap.get(item.id)!;
      // A member's zone link must follow its zone's new id; a link to a zone outside this set clears.
      const zoneId = item.zoneId !== undefined ? idMap.get(item.zoneId) : undefined;
      if (item.content.kind === 'connection') {
         return {
            ...item,
            id,
            zoneId,
            content: {
               ...item.content,
               // Keep the original endpoint if it somehow points outside this board.
               from: idMap.get(item.content.from) ?? item.content.from,
               to: idMap.get(item.content.to) ?? item.content.to,
            },
         };
      }
      // A portal targeting a BOARD item (same-board navigator) must follow that item to its new id;
      // its other target kinds (entity/element/external) name a character/board/drawer item/URL, not a
      // board item, so they ride the spread untouched.
      if (item.content.kind === 'portal' && item.content.target.kind === 'board-element') {
         return {
            ...item,
            id,
            zoneId,
            content: {
               ...item.content,
               target: {
                  ...item.content.target,
                  // Keep the original id if it somehow points outside this board.
                  boardItemId: idMap.get(item.content.target.boardItemId) ?? item.content.target.boardItemId,
               },
            },
         };
      }
      return { ...item, id, zoneId };
   });

   return { ...board, id: cuid(), drawerItemId: null, items };
}
