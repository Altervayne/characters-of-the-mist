// -- Library Imports --
import cuid from 'cuid';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * Re-identification of a Note aggregate, for forking a saved note into an independent copy
 * (Save-As on an already-saved note). A Note is a flat document - `id`, `title`, `body`, and
 * an optional value-object `cover` (no ids of its own) - so, unlike a board, it carries no
 * intra-aggregate id references to remap: a fresh top-level id is the whole job. NOTE is
 * `deepReId`-exempt precisely because its id keys its own focus-or-open round-trip; this mints
 * exactly that one new id and leaves everything else verbatim.
 */

/**
 * Returns a clone of `note` with a fresh id. The input is left unmodified.
 *
 * @param note - The source note aggregate.
 * @returns A new aggregate with an independent id; title/body/cover copied verbatim.
 */
export function reIdNote(note: Note): Note {
   return { ...note, id: cuid() };
}
