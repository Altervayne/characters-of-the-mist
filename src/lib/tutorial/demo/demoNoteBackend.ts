// -- Notes Data Layer Imports --
import { NOTE_SCHEMA_VERSION, recordToNote } from '@/lib/notes/noteRecords';

// -- Local Imports --
import { isDemoId } from './demoSentinels';

// -- Type Imports --
import type { NoteRecord } from '@/lib/notes/noteRecords';
import type { Note } from '@/lib/types/board';

/*
 * The per-id in-memory backend the note repository funnels a demo note through, the sibling of the board one.
 * A Note is a single flat document, so a demo note is ONE in-memory record (no normalization, unlike a board):
 * the repository routes every read AND write for a demo note id here, touching Dexie for NOTHING. The note
 * store's debounce-save, a portal jump's `importNote`, and an explicit save all land in memory and persist to
 * nowhere; the record is discarded on teardown.
 *
 * Ownership is by the sentinel PREFIX (`isDemoId`), not by presence in the map: a demo note id can NEVER reach
 * Dexie, whether or not its record is currently installed - so a debounced save that fires after teardown lands
 * on a graceful in-memory no-op rather than leaking a ghost row.
 *
 * A pure leaf: no store, no Dexie, no React, and crucially no import of the repository it backs (which imports
 * this) - only the note types, the record constants, and the sentinel predicate.
 */

/** Demo noteId -> its in-memory record. Multiple ids coexist alongside the demo boards in the portal graph. */
const notes = new Map<string, NoteRecord>();

/** True for any demo note id (installed or not), so its writes can never fall through to Dexie. */
export function ownsNote(id: string): boolean {
   return isDemoId(id);
}

/** Loads a demo note aggregate into the backend (hydrated by the seed, then read back through `loadNote`). */
export function installDemoNote(note: Note): void {
   notes.set(note.id, {
      id: note.id,
      title: note.title,
      body: note.body,
      cover: note.cover,
      updatedAt: Date.now(),
      drawerItemId: null,
      schemaVersion: NOTE_SCHEMA_VERSION,
   });
}

/** Drops a demo note. Idempotent. */
export function disposeDemoNote(id: string): void {
   notes.delete(id);
}

// ==================
//  Routed repository functions - the demo half of each `noteRepository` export
// ==================
//
// Each mirrors its Dexie sibling's contract, but reads/writes the in-memory record. Values are
// `structuredClone`d across the boundary to match Dexie's detached-copy semantics (a caller mutating a
// returned record must not corrupt the backend).

/** {@link import('@/lib/notes/noteRepository').getNote} for a demo note. */
export async function getNote(id: string): Promise<NoteRecord | undefined> {
   const record = notes.get(id);
   return record ? structuredClone(record) : undefined;
}

/** {@link import('@/lib/notes/noteRepository').loadNote} for a demo note. */
export async function loadNote(id: string): Promise<Note | undefined> {
   const record = notes.get(id);
   return record ? recordToNote(structuredClone(record)) : undefined;
}

/** {@link import('@/lib/notes/noteRepository').patchNote} for a demo note. No-op on an absent (disposed) id. */
export async function patchNote(id: string, patch: Partial<Pick<NoteRecord, 'title' | 'body' | 'cover'>>): Promise<void> {
   const record = notes.get(id);
   if (!record) return;
   notes.set(id, { ...record, ...structuredClone(patch), updatedAt: Date.now() });
}

/** {@link import('@/lib/notes/noteRepository').deleteNote} for a demo note. Idempotent on an absent id. */
export async function deleteNote(id: string): Promise<void> {
   notes.delete(id);
}

/**
 * {@link import('@/lib/notes/noteRepository').saveNoteToLinkedDrawerItem} for a demo note. The demo note is
 * never linked to a drawer item (and must never touch the real drawer), so it flushes title/body in memory and
 * always reports "not linked" -> the caller routes to "Save As".
 */
export async function saveNoteToLinkedDrawerItem(note: Note): Promise<{ linkedItemUpdated: boolean }> {
   const record = notes.get(note.id);
   if (record) notes.set(note.id, { ...record, title: note.title, body: note.body, cover: note.cover, updatedAt: Date.now() });
   return { linkedItemUpdated: false };
}

/** {@link import('@/lib/notes/noteRepository').linkNoteToDrawerItem} for a demo note (in-memory only). */
export async function linkNoteToDrawerItem(note: Note, drawerItemId: string): Promise<Note> {
   const existing = notes.get(note.id);
   const merged: NoteRecord = {
      id: note.id,
      title: note.title,
      body: note.body,
      cover: note.cover,
      updatedAt: Date.now(),
      drawerItemId,
      schemaVersion: existing?.schemaVersion ?? NOTE_SCHEMA_VERSION,
   };
   notes.set(note.id, merged);
   return recordToNote(merged);
}

/**
 * {@link import('@/lib/notes/noteRepository').importNote} for a demo note. The sharp leak this closes: a portal
 * jump into a closed note runs `openNoteReference` -> `importNote`, whose Dexie sibling is a `db.notes.put`; for
 * a demo id it materializes into memory instead. No-op semantics never apply - an import always writes its row.
 */
export async function importNote(note: Note, drawerItemId: string | null): Promise<void> {
   notes.set(note.id, {
      id: note.id,
      title: note.title,
      body: note.body,
      cover: note.cover,
      updatedAt: Date.now(),
      drawerItemId: drawerItemId || null,
      schemaVersion: NOTE_SCHEMA_VERSION,
   });
}
