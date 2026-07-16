// -- Library Imports --
import cuid from 'cuid';

// -- Local Imports --
import { drawerDatabase as db } from '@/lib/drawer/drawerDatabase';
import { NOTE_SCHEMA_VERSION, recordToNote } from './noteRecords';
import * as demoNoteBackend from '@/lib/tutorial/demo/demoNoteBackend';

// -- Type Imports --
import type { NoteRecord } from './noteRecords';
import type { Note } from '@/lib/types/board';

/*
 * Framework-agnostic data-access layer for Notes. Pure persistence: no React, no zustand,
 * no toasts, no console. A Note is a single flat document, so the whole aggregate lives in
 * one `notes` row (no normalization, unlike boards). Mirrors the board repository's
 * create / load / save / link / import / clear surface, minus the item-row machinery.
 * Nothing outside this module touches `db.notes`.
 *
 * This is the ONE Dexie boundary the note store funnels through, so it is also where the
 * tutorial engine's demo note is isolated: a demo note id routes to a per-id in-memory backend
 * that touches Dexie for NOTHING, while every real id is unchanged. The demo note's edits (and
 * a portal jump's `importNote`) thus live in memory and persist nowhere.
 */

/** The default title a new Note gets, until the user names it. */
export const DEFAULT_NOTE_TITLE = '';

/** Builds a fresh, empty Note aggregate with a new id. */
export function buildNewNote(): Note {
   return { id: cuid(), title: DEFAULT_NOTE_TITLE, body: '' };
}

/** Creates a new, empty note row and returns the stored record. */
export async function createNote(): Promise<NoteRecord> {
   const record: NoteRecord = {
      id: cuid(),
      title: DEFAULT_NOTE_TITLE,
      body: '',
      updatedAt: Date.now(),
      drawerItemId: null,
      schemaVersion: NOTE_SCHEMA_VERSION,
   };
   await db.notes.add(record);
   return record;
}

/** Loads a note record by id, or `undefined` if it does not exist. */
export function getNote(id: string): Promise<NoteRecord | undefined> {
   if (demoNoteBackend.ownsNote(id)) return demoNoteBackend.getNote(id);
   return db.notes.get(id);
}

/** Loads a note and assembles its {@link Note} aggregate, or `undefined` when absent. */
export async function loadNote(id: string): Promise<Note | undefined> {
   if (demoNoteBackend.ownsNote(id)) return demoNoteBackend.loadNote(id);
   const record = await db.notes.get(id);
   return record ? recordToNote(record) : undefined;
}

/** Upserts a note record, refreshing `updatedAt`. Returns the stored record. */
export async function saveNoteRecord(record: NoteRecord): Promise<NoteRecord> {
   const merged: NoteRecord = { ...record, updatedAt: Date.now() };
   await db.notes.put(merged);
   return merged;
}

/**
 * Patches a working note's title/body, refreshing `updatedAt`. A no-op when the row is
 * absent (idempotent), so a debounced save that races a close never throws.
 */
export async function patchNote(id: string, patch: Partial<Pick<NoteRecord, 'title' | 'body' | 'cover'>>): Promise<void> {
   if (demoNoteBackend.ownsNote(id)) return demoNoteBackend.patchNote(id, patch);
   await db.notes.update(id, { ...patch, updatedAt: Date.now() });
}

/** Deletes a note. Idempotent: deleting an absent id is a no-op. */
export async function deleteNote(id: string): Promise<void> {
   if (demoNoteBackend.ownsNote(id)) return demoNoteBackend.deleteNote(id);
   await db.notes.delete(id);
}

/** Outcome of {@link saveNoteToLinkedDrawerItem} (mirrors the board/character results). */
export interface SaveNoteToDrawerResult {
   /** `true` when the linked drawer item still existed and was updated; `false` -> caller should "Save As". */
   linkedItemUpdated: boolean;
}

/**
 * Explicit "Save Note": in ONE transaction, flush the working note onto its row, then -
 * when it is linked to a drawer `NOTE` item that still exists - replace that item's
 * content with the freshly assembled aggregate. Atomic, mirroring the board save. A
 * dangling link returns `false` so the caller routes to "Save As".
 */
export function saveNoteToLinkedDrawerItem(note: Note): Promise<SaveNoteToDrawerResult> {
   if (demoNoteBackend.ownsNote(note.id)) return demoNoteBackend.saveNoteToLinkedDrawerItem(note);
   return db.transaction('rw', [db.notes, db.items], async () => {
      const record = await db.notes.get(note.id);
      if (!record) return { linkedItemUpdated: false };
      const merged: NoteRecord = { ...record, title: note.title, body: note.body, cover: note.cover, updatedAt: Date.now() };
      await db.notes.put(merged);

      const drawerItemId = merged.drawerItemId ?? null;
      if (drawerItemId) {
         const existingItem = await db.items.get(drawerItemId);
         if (existingItem) {
            await db.items.update(drawerItemId, { content: recordToNote(merged), name: merged.title });
            return { linkedItemUpdated: true };
         }
      }
      return { linkedItemUpdated: false };
   });
}

/**
 * Links the working note to a (new) drawer item id (for "Save As"), flushing the current
 * title/body, and returns the aggregate to seed that drawer item's content.
 */
export function linkNoteToDrawerItem(note: Note, drawerItemId: string): Promise<Note> {
   if (demoNoteBackend.ownsNote(note.id)) return demoNoteBackend.linkNoteToDrawerItem(note, drawerItemId);
   return db.transaction('rw', [db.notes], async () => {
      const record = await db.notes.get(note.id);
      const merged: NoteRecord = {
         id: note.id,
         title: note.title,
         body: note.body,
         cover: note.cover,
         updatedAt: Date.now(),
         drawerItemId,
         schemaVersion: record?.schemaVersion ?? NOTE_SCHEMA_VERSION,
      };
      await db.notes.put(merged);
      return recordToNote(merged);
   });
}

/**
 * Materializes a Note aggregate into the working table - the inverse of {@link loadNote}.
 * Used when opening a Note from its drawer copy: the drawer aggregate is the source of
 * truth on open, so any existing row for this note id is replaced. Keeps the same id so a
 * reopen focuses-or-restores the same note losslessly. `drawerItemId` links the working
 * copy back to the saved item it opened from, or is null for an unlinked import (a first
 * save then routes to "Save As").
 */
export async function importNote(note: Note, drawerItemId: string | null): Promise<void> {
   if (demoNoteBackend.ownsNote(note.id)) return demoNoteBackend.importNote(note, drawerItemId);
   const record: NoteRecord = {
      id: note.id,
      title: note.title,
      body: note.body,
      cover: note.cover,
      updatedAt: Date.now(),
      drawerItemId: drawerItemId || null,
      schemaVersion: NOTE_SCHEMA_VERSION,
   };
   await db.notes.put(record);
}

/**
 * Lists EVERY working note aggregate, for the asset GC's reference scan (a note's inline images live
 * in its `body`, so an unsaved open note's art would be reclaimed if the sweep never saw it). Reads
 * the whole `notes` table; the sweep runs rarely, so the full read is fine.
 */
export async function listAllNotes(): Promise<Note[]> {
   const records = await db.notes.toArray();
   return records.map(recordToNote);
}

/** Deletes every note row (powers "Reset app"), mirroring `clearAllBoards`. */
export async function clearAllNotes(): Promise<void> {
   await db.notes.clear();
}
