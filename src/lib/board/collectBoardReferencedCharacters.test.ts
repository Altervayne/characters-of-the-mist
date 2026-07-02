// -- Library Imports --
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { collectBoardReferencedCharacters } from './collectBoardReferencedCharacters';
import {
   disposeInstance,
   getCharacterInstanceIds,
   getOrCreateInstance,
} from '@/lib/character/characterStoreRegistry';

// -- Type Imports --
import type { Board, BoardItem, CharacterBoardContent } from '@/lib/types/board';
import type { Character } from '@/lib/types/character';

/*
 * Tests for the export-side character-reference resolver: it walks a board's character elements and
 * resolves each unique reference to its full Character, saved-source-first, so an export can carry the
 * data. Framework-free (Dexie on fake-indexeddb; the character store instances are plain vanilla stores).
 */

function character(id: string): Character {
   return { id, name: `Hero ${id}`, game: 'LEGENDS', cards: [], trackers: { statuses: [], storyTags: [], storyThemes: [] } } as unknown as Character;
}

function charItem(id: string, content: CharacterBoardContent): BoardItem {
   return { id, kind: 'character', x: 0, y: 0, width: 0, height: 0, z: 0, content };
}

function board(items: BoardItem[]): Board {
   return { id: 'b', name: 'Board', viewport: { x: 0, y: 0, zoom: 1 }, items };
}

/** Seeds a saved drawer item so `resolveReferencedDrawerItem` reads it as live. */
async function seedDrawerCharacter(itemId: string, char: Character): Promise<void> {
   await drawerDatabase.items.put({
      id: itemId, name: char.name, parentFolderId: 'root', order: 0,
      game: 'LEGENDS', type: 'FULL_CHARACTER_SHEET', createdAt: 0, updatedAt: 0, content: char,
   });
}

/** Registers a live open instance holding `char`. Returns its id (dispose in cleanup). */
function openInstance(id: string, char: Character): string {
   getOrCreateInstance(id).setState({ character: char });
   return id;
}

const openedIds: string[] = [];
afterEach(() => {
   for (const id of openedIds.splice(0)) disposeInstance(id);
});
beforeEach(async () => {
   await drawerDatabase.items.clear();
});

describe('collectBoardReferencedCharacters', () => {
   it('resolves from the saved drawer source (authoritative)', async () => {
      const saved = character('cid-1');
      await seedDrawerCharacter('src-1', saved);

      const result = await collectBoardReferencedCharacters(
         board([charItem('e1', { kind: 'character', characterId: 'cid-1', sourceDrawerItemId: 'src-1' })]),
      );

      expect(result).toEqual({ 'cid-1': saved });
   });

   it('prefers the saved source over an open live instance', async () => {
      const saved = character('cid-2');
      await seedDrawerCharacter('src-2', saved);
      openedIds.push(openInstance('cid-2', character('cid-2-live'))); // a divergent live copy under the same id

      const result = await collectBoardReferencedCharacters(
         board([charItem('e1', { kind: 'character', characterId: 'cid-2', sourceDrawerItemId: 'src-2' })]),
      );

      expect(result['cid-2']).toEqual(saved);
   });

   it('falls back to the live open instance for an unsaved character (no source)', async () => {
      const live = character('cid-live');
      openedIds.push(openInstance('cid-live', live));

      const result = await collectBoardReferencedCharacters(
         board([charItem('e1', { kind: 'character', characterId: 'cid-live' })]),
      );

      expect(result).toEqual({ 'cid-live': live });
   });

   it('falls back to lastKnown when there is no source and no open instance', async () => {
      const cached = character('cid-lk');

      const result = await collectBoardReferencedCharacters(
         board([charItem('e1', { kind: 'character', characterId: 'cid-lk', lastKnown: cached })]),
      );

      expect(result).toEqual({ 'cid-lk': cached });
   });

   it('uses lastKnown when the saved source is gone (dangling)', async () => {
      const cached = character('cid-dangle');

      const result = await collectBoardReferencedCharacters(
         board([charItem('e1', { kind: 'character', characterId: 'cid-dangle', sourceDrawerItemId: 'missing', lastKnown: cached })]),
      );

      expect(result).toEqual({ 'cid-dangle': cached });
   });

   it('skips an unresolvable reference without materializing a phantom instance', async () => {
      const result = await collectBoardReferencedCharacters(
         board([charItem('e1', { kind: 'character', characterId: 'cid-gone' })]),
      );

      expect(result).toEqual({});
      // The closed character must never be created just to peek at it.
      expect(getCharacterInstanceIds()).not.toContain('cid-gone');
   });

   it('de-dupes: several elements on one character yield a single entry', async () => {
      const saved = character('cid-dup');
      await seedDrawerCharacter('src-dup', saved);

      const result = await collectBoardReferencedCharacters(
         board([
            charItem('e1', { kind: 'character', characterId: 'cid-dup', sourceDrawerItemId: 'src-dup' }),
            charItem('e2', { kind: 'character', characterId: 'cid-dup', sourceDrawerItemId: 'src-dup' }),
         ]),
      );

      expect(Object.keys(result)).toEqual(['cid-dup']);
   });

   it('ignores non-character items and returns empty when there are none', async () => {
      const result = await collectBoardReferencedCharacters(
         board([{ id: 'img', kind: 'image', x: 0, y: 0, width: 0, height: 0, z: 0, content: { kind: 'image', assetId: 'a', fit: 'cover' } }]),
      );

      expect(result).toEqual({});
   });
});
