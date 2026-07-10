// -- Library Imports --
import cuid from 'cuid';

// -- Drawer Imports --
import { createItem, getNoteItemIdMap } from '@/lib/drawer/drawerRepository';

// -- Type Imports --
import type { Board, Note, NoteBoardContent } from '@/lib/types/board';

/*
 * The board-import counterpart to the export-side note embed (mirrors the character path): a board file
 * carries the full data of every note its reference tiles point at, and here we turn that data into local
 * drawer notes and point the tiles at them. Dedup is by the PRESERVED note id (a globally-unique cuid, the
 * same on every machine): a note already in the drawer is LINKED (never duplicated, never overwritten); an
 * absent one is recreated keeping its id. Embedded covers/inline images are already restored by importFromFile.
 */

/**
 * Links or recreates the notes an imported board references, returning a map from each source note id to the
 * LOCAL drawer item id backing it (for the tile rewire). A note already in the drawer is linked to its
 * existing item; an absent one is created as a `NOTE` drawer item with its id kept. `ensureFolder` lazily
 * makes (and memoizes) the shared "Imported from {board}" landing folder - called only when a note is
 * actually recreated, so pure links create no folder.
 */
export async function rehydrateBoardReferencedNotes(
   notes: Record<string, Note> | undefined,
   ensureFolder: () => Promise<string>,
): Promise<Map<string, string>> {
   const drawerItemIdByNoteId = new Map<string, string>();
   if (!notes) return drawerItemIdByNoteId;

   const existing = await getNoteItemIdMap();

   for (const [noteId, note] of Object.entries(notes)) {
      const existingItemId = existing.get(noteId);
      if (existingItemId) {
         drawerItemIdByNoteId.set(noteId, existingItemId); // link, never overwrite
         continue;
      }

      // The drawer item gets a fresh id; the note keeps its own (the dedup key). A note is game-agnostic.
      const drawerItemId = cuid();
      await createItem({
         id: drawerItemId,
         name: note.title,
         game: 'NEUTRAL',
         type: 'NOTE',
         content: note,
         parentFolderId: await ensureFolder(),
      });
      drawerItemIdByNoteId.set(noteId, drawerItemId);
   }

   return drawerItemIdByNoteId;
}

/**
 * Points every note REFERENCE tile at its local drawer item: sets `sourceDrawerItemId` to the item id for
 * the tile's `noteId` and clears the stale `lastKnown`. `noteId` is left as-is (the preserved id). A tile
 * whose note had no embed entry (unresolvable at export) is left untouched, so it dangles as before; a COPY
 * tile is self-contained and never rewired. Pure - returns a new aggregate.
 */
export function rewireBoardNoteReferences(board: Board, drawerItemIdByNoteId: Map<string, string>): Board {
   const items = board.items.map((item) => {
      if (item.content.kind !== 'note' || item.content.mode !== 'reference') return item;
      const sourceDrawerItemId = drawerItemIdByNoteId.get(item.content.noteId);
      if (!sourceDrawerItemId) return item; // no embed for this reference - leave it dangling
      const content: NoteBoardContent = { kind: 'note', mode: 'reference', noteId: item.content.noteId, sourceDrawerItemId };
      return { ...item, content };
   });
   return { ...board, items };
}
