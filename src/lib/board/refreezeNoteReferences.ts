// -- Data Layer Imports --
import { listAllBoardItems, updateItem } from '@/lib/board/boardRepository';
import { getBoardInstanceIds, getOrCreateBoardInstance } from '@/lib/board/boardStoreRegistry';
import { detachNoteToCopy } from '@/lib/board/referenceContent';

// -- Type Imports --
import type { BoardItemRecord } from '@/lib/board/boardRecords';
import type { Note, NoteBoardContent } from '@/lib/types/board';

/*
 * When the tab of a DRAWER-LESS (never-saved) note closes, any board item referencing it would orphan - no
 * open store, no drawer item. So instead of keeping the working row alive, each such reference is RE-FROZEN
 * to a self-contained COPY carrying the note's latest content, and the working row is then reaped. Net: a
 * drawer-less note never survives its tab closing (no orphan working row), and a board tile reads as "linked"
 * only while it points at something reachable - an open tab or a saved drawer note. A drawer-BACKED reference
 * is untouched here (it keeps resolving via its drawer item).
 */

/** One re-freeze target: the board item id + its board, and the frozen-copy content it becomes. */
export interface NoteRefreezePlanEntry {
   id: string;
   boardId: string;
   content: NoteBoardContent;
}

/**
 * Pure: the re-freeze plan for note `noteId` given the full board-item set - every item that is a live
 * reference to it, mapped to the frozen COPY it becomes (the latest note snapshot, via the shared
 * {@link detachNoteToCopy} transform, so the content shape stays single-sourced). Non-references and other
 * kinds are skipped.
 */
export function planNoteRefreeze(items: BoardItemRecord[], noteId: string, latestNote: Note): NoteRefreezePlanEntry[] {
   return items
      .filter((item) => item.kind === 'note' && item.content.kind === 'note' && item.content.mode === 'reference' && item.content.noteId === noteId)
      .map((item) => ({ id: item.id, boardId: item.boardId, content: detachNoteToCopy(item.content as NoteBoardContent, latestNote) }));
}

/**
 * Applies the re-freeze: flips every board reference to `noteId` into a frozen copy carrying `latestNote`.
 * An OPEN board's item is written in memory (+persisted) via the non-undoable direct-write action so its tile
 * updates live; a closed board's row is persisted directly. Non-undoable - a lifecycle transition triggered
 * by closing a note tab, never a board edit, so it must not touch any board's undo stack.
 */
export async function refreezeDrawerlessNoteReferences(noteId: string, latestNote: Note): Promise<void> {
   const plan = planNoteRefreeze(await listAllBoardItems(), noteId, latestNote);
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
