// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { createItem } from '@/lib/drawer/drawerRepository';
import { chooseLinkIcon, loadLinkMetadata, resolveLocalLinkMetadata } from './linkMetadata';

// -- Type Imports --
import type { LinkTarget } from './linkTarget';
import type { NoteHeading } from '@/lib/notes/noteOutline';
import type { Note } from '@/lib/types/board';

/*
 * Tests for the Portals link-metadata layer: local (section/external) resolution is pure; entity/element
 * resolution reads the drawer (Dexie on fake-indexeddb). Each async case uses a UNIQUE id so the module-level
 * metadata cache never returns a stale result from an earlier case.
 */

const heading = (text: string, slug: string): NoteHeading => ({ level: 1, text, slug, from: 0, to: 0 });

beforeEach(async () => {
   await drawerDatabase.items.clear();
   await drawerDatabase.folders.clear();
});

describe('resolveLocalLinkMetadata', () => {
   it('resolves a present section to its heading text', () => {
      const headings = [heading('Overview', 'overview'), heading('Details', 'details')];
      const target: LinkTarget = { kind: 'section', slug: 'details' };
      expect(resolveLocalLinkMetadata(target, headings)).toEqual({ exists: true, displayName: 'Details' });
   });

   it('marks a missing section as a confirmed miss', () => {
      const headings = [heading('Overview', 'overview')];
      const target: LinkTarget = { kind: 'section', slug: 'gone' };
      expect(resolveLocalLinkMetadata(target, headings)).toEqual({ exists: false });
   });

   it('resolves an external link to its URL, always existing', () => {
      const target: LinkTarget = { kind: 'external', href: 'https://example.com' };
      expect(resolveLocalLinkMetadata(target, [])).toEqual({ exists: true, displayName: 'https://example.com' });
   });

   it('returns null for a drawer-resolved target (entity/element)', () => {
      expect(resolveLocalLinkMetadata({ kind: 'entity', entity: 'note', id: 'x' }, [])).toBeNull();
      expect(resolveLocalLinkMetadata({ kind: 'element', drawerItemId: 'y' }, [])).toBeNull();
   });
});

describe('loadLinkMetadata (entity)', () => {
   it('names a present entity from its drawer item and marks it existing', async () => {
      const note: Note = { id: 'ent-note-hit', title: 'Session Prep', body: '' };
      await createItem({ name: 'Session Prep', game: 'NEUTRAL', type: 'NOTE', content: note, parentFolderId: null });

      const metadata = await loadLinkMetadata({ kind: 'entity', entity: 'note', id: 'ent-note-hit' });
      expect(metadata).toEqual({ exists: true, displayName: 'Session Prep', itemType: 'NOTE' });
   });

   it('marks an absent entity as a confirmed miss', async () => {
      const metadata = await loadLinkMetadata({ kind: 'entity', entity: 'character', id: 'ent-char-miss' });
      expect(metadata).toEqual({ exists: false });
   });
});

describe('loadLinkMetadata (element)', () => {
   it('names a present element and carries its concrete type', async () => {
      const record = await createItem({ name: 'Danger', game: 'CITY_OF_MIST', type: 'CHALLENGE_CARD', content: { id: 'c' } as never, parentFolderId: null });

      const metadata = await loadLinkMetadata({ kind: 'element', drawerItemId: record.id });
      expect(metadata).toEqual({ exists: true, displayName: 'Danger', itemType: 'CHALLENGE_CARD' });
   });

   it('marks an absent element as a confirmed miss', async () => {
      const metadata = await loadLinkMetadata({ kind: 'element', drawerItemId: 'el-miss' });
      expect(metadata).toEqual({ exists: false });
   });
});

describe('chooseLinkIcon', () => {
   it('shows the dead glyph on a confirmed miss, whatever the kind', () => {
      expect(chooseLinkIcon({ kind: 'element', drawerItemId: 'x' }, { exists: false })).toEqual({ kind: 'dead' });
      expect(chooseLinkIcon({ kind: 'section', slug: 's' }, { exists: false })).toEqual({ kind: 'dead' });
   });

   it('shows the hash for a section and the entity type icon for an entity', () => {
      expect(chooseLinkIcon({ kind: 'section', slug: 's' }, { exists: true })).toEqual({ kind: 'section' });
      expect(chooseLinkIcon({ kind: 'entity', entity: 'board', id: 'b' }, { exists: true })).toEqual({ kind: 'itemType', itemType: 'FULL_BOARD' });
   });

   it('shows an element real type once known, else the generic link glyph', () => {
      expect(chooseLinkIcon({ kind: 'element', drawerItemId: 'x' }, undefined)).toEqual({ kind: 'generic' });
      expect(chooseLinkIcon({ kind: 'element', drawerItemId: 'x' }, { exists: true, itemType: 'POST_IT' })).toEqual({ kind: 'itemType', itemType: 'POST_IT' });
   });
});
