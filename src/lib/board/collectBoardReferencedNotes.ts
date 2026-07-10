// -- Board Imports --
import { resolveReferencedDrawerItem } from './useReferencedDrawerItem';

// -- Notes Imports --
import { getNoteInstanceIds, getOrCreateNoteInstance } from '@/lib/notes/noteStoreRegistry';

// -- Type Imports --
import type { Board, Note } from '@/lib/types/board';

/*
 * Resolves the full current Note behind a board's note REFERENCE tiles so an export can carry the data a
 * bare note id can't. A reference tile is a live read-only mirror; on another machine the id names nothing,
 * so we embed the note itself and let the importer recreate it. A COPY tile is self-contained (its `data`
 * rides in the board item) and is skipped here.
 */

/**
 * Walks `board.items` for note references and resolves each unique referenced note id to its full Note,
 * keyed by that id. Resolution order (authoritative first), mirroring the character collector:
 *   1. the saved drawer source (`sourceDrawerItemId`), when the read is live;
 *   2. the live open-tab instance, for a drawer-less (materialized, unsaved) note - peeked only, never
 *      created;
 *   3. the tile's cached `lastKnown`.
 * An unresolvable reference is skipped: it imports as a graceful dangling placeholder. De-duped by note id.
 */
export async function collectBoardReferencedNotes(board: Board): Promise<Record<string, Note>> {
   const resolved: Record<string, Note> = {};

   for (const item of board.items) {
      const content = item.content;
      if (content.kind !== 'note' || content.mode !== 'reference') continue;

      const { noteId, sourceDrawerItemId, lastKnown } = content;
      if (resolved[noteId]) continue; // already embedded via an earlier tile

      // 1. The saved drawer item is the authoritative copy - the note as persisted.
      if (sourceDrawerItemId) {
         const source = await resolveReferencedDrawerItem(sourceDrawerItemId);
         if (source.status === 'live' && source.content) {
            resolved[noteId] = source.content as Note;
            continue;
         }
      }

      // 2. An open tab covers a drawer-less note. Peek only via the instance-id list; never
      //    getOrCreateNoteInstance for an id it doesn't contain, or a phantom instance would be born.
      if (getNoteInstanceIds().includes(noteId)) {
         const live = getOrCreateNoteInstance(noteId).getState().note;
         if (live) {
            resolved[noteId] = live;
            continue;
         }
      }

      // 3. The tile's own last read, when there's nothing better.
      if (lastKnown) resolved[noteId] = lastKnown;
   }

   return resolved;
}
