// -- Library Imports --
import { beforeEach, describe, expect, it } from 'vitest';

// -- Local Imports --
import { drawerDatabase } from '@/lib/drawer/drawerDatabase';
import { resolveReferencedDrawerItem } from './useReferencedDrawerItem';

// -- Type Imports --
import type { DrawerItemContent } from '@/lib/types/drawer';

/*
 * Tests for the reference resolver (the read behind the live mirror), against
 * fake-indexeddb. The hook itself just re-runs this on drawer change / mount, so this
 * covers the cross-domain re-read: a source edit is reflected, a deleted source dangles.
 */

function seedDrawerItem(id: string, content: DrawerItemContent) {
   return drawerDatabase.items.add({ id, name: id, parentFolderId: 'root', order: 0, game: 'LEGENDS', type: 'STATUS_TRACKER', content });
}

beforeEach(async () => {
   await drawerDatabase.items.clear();
});

describe('resolveReferencedDrawerItem', () => {
   it('returns the live content of an existing source', async () => {
      await seedDrawerItem('src-1', { trackerType: 'STATUS', name: 'Wounded' } as unknown as DrawerItemContent);

      const result = await resolveReferencedDrawerItem('src-1');

      expect(result.status).toBe('live');
      expect(result.content).toMatchObject({ name: 'Wounded' });
   });

   it('reflects an updated source on re-read (simulating a drawer change)', async () => {
      await seedDrawerItem('src-1', { trackerType: 'STATUS', name: 'Wounded' } as unknown as DrawerItemContent);
      expect((await resolveReferencedDrawerItem('src-1')).content).toMatchObject({ name: 'Wounded' });

      // A drawer edit updates the item; the next read (what the engine subscription triggers) sees it.
      await drawerDatabase.items.update('src-1', { content: { trackerType: 'STATUS', name: 'Healed' } as unknown as DrawerItemContent });

      expect((await resolveReferencedDrawerItem('src-1')).content).toMatchObject({ name: 'Healed' });
   });

   it('dangles when the source has been deleted', async () => {
      await seedDrawerItem('src-1', { trackerType: 'STATUS', name: 'Wounded' } as unknown as DrawerItemContent);
      await drawerDatabase.items.delete('src-1');

      const result = await resolveReferencedDrawerItem('src-1');

      expect(result.status).toBe('dangling');
      expect(result.content).toBeNull();
   });
});
