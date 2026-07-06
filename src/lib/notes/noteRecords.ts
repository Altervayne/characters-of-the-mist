// -- Type Imports --
import type { Note } from '@/lib/types/board';

/**
 * The per-record schema version for note rows, written to `NoteRecord.schemaVersion`.
 * Tracks the Dexie `notes` store; bump it (with a Dexie version upgrade) when the record
 * shape itself changes.
 */
export const NOTE_SCHEMA_VERSION = 1;

/**
 * One row per open/working Note in the `notes` store. A Note is a single flat markdown
 * document, so the whole aggregate is stored inline (unlike a board, which is normalized
 * into item rows). `updatedAt` powers last-write-wins; `drawerItemId` links the working
 * note to its saved drawer copy, mirroring `CharacterRecord.drawerItemId`.
 */
export interface NoteRecord {
   /** Primary key (a stable cuid assigned at creation, shared with the aggregate `id`). */
   id: string;
   /** Document title; also the tab / drawer / preview name. */
   title: string;
   /** The one continuous markdown flow. */
   body: string;
   /** Epoch milliseconds of the last save; drives recents ordering and last-write-wins. */
   updatedAt: number;
   /** The drawer `NOTE` item this note is linked to, or null when unsaved (mirrors `CharacterRecord.drawerItemId`). */
   drawerItemId?: string | null;
   /** Per-record schema marker for future record-shape migrations. */
   schemaVersion: number;
}

/** Projects a stored record onto the {@link Note} aggregate (drops persistence-only fields). */
export function recordToNote(record: NoteRecord): Note {
   return { id: record.id, title: record.title, body: record.body };
}
