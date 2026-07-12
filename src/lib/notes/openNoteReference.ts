// -- Repository Imports --
import { importNote } from '@/lib/notes/noteRepository';
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { useTabManagerActions } from '@/lib/character/tabManagerStore';
import type { Note } from '@/lib/types/board';

/*
 * Opens a saved note in its tab: focuses it when already open (never re-imports, which would clobber unsaved
 * edits), else materializes the note aggregate into the working table (linked to its drawer source when it has
 * one) and opens it by id. `note` is the aggregate in hand - the live instance, the working row, or the drawer
 * read - seeding the import. Extracted from the board note tile so both the tile and the Portals link dispatch
 * open a note the same way.
 */
export function openNoteReference(
   noteId: string,
   note: Note,
   sourceDrawerItemId: string | undefined,
   actions: ReturnType<typeof useTabManagerActions>,
): void {
   if (useTabManagerStore.getState().openTabs.some((tab) => tab.id === noteId)) {
      actions.setActiveTab(noteId);
      return;
   }
   void importNote(note, sourceDrawerItemId ?? null).then(() => actions.openNoteTab(noteId));
}
