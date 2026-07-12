// -- Registry Imports --
import { getActiveBoardStore } from '@/lib/board/boardStoreRegistry';
import { getActiveNoteStore } from '@/lib/notes/noteStoreRegistry';
import { getActiveCharacterStore } from '@/lib/character/characterStoreRegistry';

// -- Re-ID Imports --
import { reIdBoardAggregate } from '@/lib/board/reIdBoardAggregate';
import { reIdNote } from '@/lib/notes/reIdNote';
import { reIdCharacter } from '@/lib/character/reIdCharacter';

// -- Repository Imports --
import { importBoard } from '@/lib/board/boardRepository';
import { importNote } from '@/lib/notes/noteRepository';
import { saveCharacter } from '@/lib/character/characterRepository';

// -- Store Imports --
import { useTabManagerStore } from '@/lib/character/tabManagerStore';

// -- Type Imports --
import type { Board, Note } from '@/lib/types/board';
import type { Character } from '@/lib/types/character';

/*
 * Save-As FORK: turns the ACTIVE saved entity into a fresh, independent copy that the working tab ADOPTS
 * (owner-locked Option A). Each fork (1) re-ids the whole aggregate to a new identity bound to the new drawer
 * item id, (2) materializes the fork's working rows under that new id, then (3) re-keys the tab from the old
 * id to the new one (`rekeyEntityTab`), which also reaps the old working rows. The ORIGINAL drawer item is
 * never touched, and references to the original (portals / character-on-board / note tiles) STAY on the
 * original - the fork is a brand-new, unreferenced entity. This is the LINKED branch only; a first-save
 * (unlinked) keeps its id and links to one drawer item, and stays on its existing path.
 *
 * These return the forked aggregate so the caller (`useSaveToDrawer`) can seed the new drawer item via the
 * naming window; the drawer-open + `initiateItemDrop` stay in the React hook.
 */

/** Forks the active board to a fresh identity bound to `newItemId`, adopting it into the tab. Returns the fork, or `null` when no board is active. */
export async function forkBoardToDrawerItem(newItemId: string): Promise<Board | null> {
   const store = getActiveBoardStore();
   if (!store) return null;
   const { boardId, name, viewport, grid, items } = store.getState();
   if (!boardId) return null;

   // Re-id the WHOLE aggregate (fresh board id + item ids, with connection/zone/portal targets remapped
   // through the same id map), then bind it to the new drawer item. Built from live store state so an
   // un-persisted camera/edit rides along into the fork.
   const source: Board = { id: boardId, name, viewport, grid, drawerItemId: null, items: Object.values(items) };
   const forked: Board = { ...reIdBoardAggregate(source), drawerItemId: newItemId };

   await importBoard(forked);
   await useTabManagerStore.getState().actions.rekeyEntityTab('board', boardId, forked.id);
   return forked;
}

/** Forks the active note to a fresh identity bound to `newItemId`, adopting it into the tab. References STAY on the original. Returns the fork, or `null` when no note is active. */
export async function forkNoteToDrawerItem(newItemId: string): Promise<Note | null> {
   const store = getActiveNoteStore();
   if (!store) return null;
   const { noteId, note } = store.getState();
   if (!noteId || !note) return null;

   const forked = reIdNote(note);
   await importNote(forked, newItemId);
   await useTabManagerStore.getState().actions.rekeyEntityTab('note', noteId, forked.id);
   return forked;
}

/** Forks the active character to a fresh identity bound to `newItemId`, adopting it into the tab. Returns the fork, or `null` when no character is active. */
export async function forkCharacterToDrawerItem(newItemId: string): Promise<Character | null> {
   const store = getActiveCharacterStore();
   if (!store) return null;
   const character = store.getState().character;
   if (!character) return null;

   // A character carries no id cross-references, so a deep re-id is total and safe (same path the drawer's
   // addItem already runs on a copy). Persist the working row under the new id BEFORE the tab re-key hydrates
   // it back (characters have no `importCharacter`; `saveCharacter` is the working-row write).
   const forked: Character = { ...reIdCharacter(character), drawerItemId: newItemId };
   await saveCharacter(forked);
   await useTabManagerStore.getState().actions.rekeyEntityTab('character', character.id, forked.id);
   return forked;
}
