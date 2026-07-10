// -- Board Imports --
import { collectBoardReferencedCharacters } from './collectBoardReferencedCharacters';
import { collectBoardReferencedNotes } from './collectBoardReferencedNotes';

// -- Type Imports --
import type { Board } from '@/lib/types/board';
import type { EmbeddedEntities } from '@/lib/utils/export-import';

/*
 * The one place a board export gathers the FULL data of every entity its tiles only reference - the
 * characters behind character elements and the notes behind reference note tiles - so those live references
 * survive on another machine. Shared by every export entry point, so a site can't embed one kind and forget
 * the other. Returns `undefined` when nothing needs embedding (a board of copies / native items alone).
 */
export async function collectBoardEmbeddedEntities(board: Board): Promise<EmbeddedEntities | undefined> {
   const characters = await collectBoardReferencedCharacters(board);
   const notes = await collectBoardReferencedNotes(board);

   const hasCharacters = Object.keys(characters).length > 0;
   const hasNotes = Object.keys(notes).length > 0;
   if (!hasCharacters && !hasNotes) return undefined;

   return {
      ...(hasCharacters ? { characters } : {}),
      ...(hasNotes ? { notes } : {}),
   };
}
