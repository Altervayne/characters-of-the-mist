// -- Local Imports --
import { buildNewNote } from './noteRepository';

// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * The `.md` companion to the full-fidelity `.cotm` note export: a note as a portable plain-text
 * document. These are the pure (DOM-free) pieces - the has-images gate, the filename, and the
 * import parse; the download + file-read live in the shared export-import utils. Images are refs,
 * not bytes, so a `.md` carries only text; the caller warns before export when a note has any.
 */

/** Matches an inline markdown image (`![alt](src)`) anywhere in a body. */
const BODY_IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/;

/** Whether a note carries any image - a note-level cover or an inline body image. */
export function noteHasImages(note: Note): boolean {
   return note.cover !== undefined || BODY_IMAGE_RE.test(note.body);
}

/** Filesystem-safe `.md` filename from a note title, falling back to `note.md` when it is empty. */
export function markdownFilename(title: string): string {
   const cleaned = title.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
   return `${cleaned || 'note'}.md`;
}

/** Strips a path prefix and a trailing extension from a picked filename, for use as a note title. */
function fileNameToTitle(fileName: string): string {
   return (fileName.split(/[/\\]/).pop() ?? '').replace(/\.[^.]+$/, '').trim();
}

/**
 * Builds a Note from imported markdown text. A leading `# ` H1 becomes the title and the rest
 * (trimmed) the body - the inverse of {@link noteToMarkdown}; otherwise the whole text is the body
 * and the filename (extension stripped) the title. A fresh id comes from the note factory, so the
 * import materializes like any other new note.
 */
export function noteFromMarkdown(text: string, fileName: string): Note {
   const note = buildNewNote();
   const h1 = /^#[ \t]+(.+?)[ \t]*(?:\r?\n([\s\S]*))?$/.exec(text);
   if (h1) {
      note.title = h1[1];
      note.body = (h1[2] ?? '').trim();
   } else {
      note.title = fileNameToTitle(fileName);
      note.body = text;
   }
   return note;
}
