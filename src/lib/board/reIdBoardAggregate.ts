// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { Board, BoardItem } from '@/lib/types/board';

/*
 * Connection-safe re-identification of a board aggregate, for importing a board file as a
 * fresh, independent copy. The generic `deepReId` is WRONG here: it remints every `id`
 * independently, so a `connection`'s `from`/`to` (which are item-id references, not `id`
 * fields) would no longer match the new ids of the items they point at. This builds one
 * old->new id map and rewrites both the item ids AND the connection endpoints through it,
 * so the lines still resolve. A reference's `sourceDrawerItemId` is left untouched - it
 * names a DRAWER item, not a board item (a missing source dangles by design, board-10).
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
      return { ...item, id, zoneId };
   });

   return { ...board, id: cuid(), drawerItemId: null, items };
}
