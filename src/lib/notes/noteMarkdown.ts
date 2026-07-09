// -- Type Imports --
import type { Note } from '@/lib/types/board';

/*
 * Plain-markdown serialization of a Note. The title is a STRUCTURED field (the tab / drawer / preview name),
 * kept separate in the `.cotm` aggregate. But wherever a note is rendered/exported as ONE plain markdown
 * string - the future print path, a copy-as-markdown, a plain `.md` export - the title must lead the document
 * as an H1, matching how it now renders above the cover in Live/Reading. This is that single mapping, so every
 * plain-markdown producer emits the same shape.
 *
 * The cover is note-level state, not a body token, so it does NOT round-trip into the plain markdown (a print
 * surface renders the cover from `note.cover` alongside this string). The `.cotm` aggregate is unaffected.
 */

/** Serializes a note to plain markdown: a leading `# {title}` H1 (when titled) over the body. */
export function noteToMarkdown(note: Note): string {
   const title = note.title.trim();
   if (!title) return note.body;
   return `# ${title}\n\n${note.body}`;
}
