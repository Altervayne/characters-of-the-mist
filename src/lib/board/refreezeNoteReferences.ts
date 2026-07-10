// -- Data Layer Imports --
import { listAllBoardItems, updateItem } from '@/lib/board/boardRepository';
import { getBoardInstanceIds, getOrCreateBoardInstance } from '@/lib/board/boardStoreRegistry';
import { detachNoteToCopy } from '@/lib/board/referenceContent';

// -- Type Imports --
import type { BoardItemRecord } from '@/lib/board/boardRecords';
import type { Note, NoteBoardContent } from '@/lib/types/board';

/*
 * Board note references are synced to note-lifecycle events that happen OFF the board (from the note tab),
 * so a tile stays honest even when its board isn't the surface in view:
 *  - RE-FREEZE (on closing a drawer-less note's tab): the reference would orphan - no open store, no drawer
 *    item - so each is flipped to a self-contained COPY carrying the note's latest content, then the working
 *    row reaps. Nothing drawer-less survives close; a tile reads "linked" only while it points at something
 *    reachable.
 *  - SOURCE-STAMP (on Saving a board-referenced note to the drawer): the save mints a drawer item but keeps
 *    the note id, so the reference is still valid - it just needs the new `sourceDrawerItemId` so a later
 *    tab-close resolves via the drawer read. The Save happens from the note tab (the board is unmounted), so
 *    this can't ride a board render effect - it runs here, against every board.
 * A drawer-BACKED reference is untouched by the re-freeze (it already resolves via its drawer item).
 */

/** One reference-sync target: the board item id + its board, and the content it becomes. */
export interface NoteReferencePlanEntry {
   id: string;
   boardId: string;
   content: NoteBoardContent;
}

/** The reference (`kind: 'note'`, `mode: 'reference'`) tiles for note `noteId` among `items`. */
function noteReferences(items: BoardItemRecord[], noteId: string): BoardItemRecord[] {
   return items.filter((item) =>
      item.kind === 'note' && item.content.kind === 'note' && item.content.mode === 'reference' && item.content.noteId === noteId,
   );
}

/**
 * Pure: the re-freeze plan for note `noteId` - every live reference to it, mapped to the frozen COPY it
 * becomes (the latest note snapshot, via the shared {@link detachNoteToCopy} so the content shape stays
 * single-sourced).
 */
export function planNoteRefreeze(items: BoardItemRecord[], noteId: string, latestNote: Note): NoteReferencePlanEntry[] {
   return noteReferences(items, noteId).map((item) => ({
      id: item.id,
      boardId: item.boardId,
      content: detachNoteToCopy(item.content as NoteBoardContent, latestNote),
   }));
}

/**
 * Pure: the source-stamp plan for note `noteId` - every live reference to it that does NOT already point at
 * `drawerItemId`, mapped to the same reference with its `sourceDrawerItemId` set (id + any `lastKnown` kept).
 * References already stamped are skipped, so a re-save writes nothing.
 */
export function planNoteSourceStamp(items: BoardItemRecord[], noteId: string, drawerItemId: string): NoteReferencePlanEntry[] {
   return noteReferences(items, noteId)
      .filter((item) => (item.content as Extract<NoteBoardContent, { mode: 'reference' }>).sourceDrawerItemId !== drawerItemId)
      .map((item) => ({
         id: item.id,
         boardId: item.boardId,
         content: { ...(item.content as NoteBoardContent), sourceDrawerItemId: drawerItemId },
      }));
}

/**
 * Applies a reference-sync plan: writes each entry's content onto its board item. An OPEN board's item is
 * written in memory (+persisted) via the non-undoable direct-write action so its tile updates live; a closed
 * board's row is persisted directly. Non-undoable - a note-lifecycle transition, never a board edit, so it
 * must not touch any board's undo stack.
 */
async function applyNoteReferencePlan(plan: NoteReferencePlanEntry[]): Promise<void> {
   if (plan.length === 0) return;

   const openBoardIds = new Set(getBoardInstanceIds());
   for (const entry of plan) {
      if (openBoardIds.has(entry.boardId)) {
         await getOrCreateBoardInstance(entry.boardId).getState().actions.cacheReferenceLastKnown(entry.id, entry.content);
      } else {
         await updateItem(entry.id, { content: entry.content });
      }
   }
}

/** Flips every board reference to `noteId` into a frozen copy carrying `latestNote` (drawer-less tab close). */
export async function refreezeDrawerlessNoteReferences(noteId: string, latestNote: Note): Promise<void> {
   await applyNoteReferencePlan(planNoteRefreeze(await listAllBoardItems(), noteId, latestNote));
}

/**
 * Stamps `drawerItemId` onto every board reference to `noteId` (on Save-to-drawer), so a reference to a
 * once-tab-only note survives the save as a live, drawer-backed reference. Idempotent - already-stamped
 * references are skipped, so re-saving a linked note writes nothing.
 */
export async function stampNoteReferencesDrawerSource(noteId: string, drawerItemId: string): Promise<void> {
   await applyNoteReferencePlan(planNoteSourceStamp(await listAllBoardItems(), noteId, drawerItemId));
}
