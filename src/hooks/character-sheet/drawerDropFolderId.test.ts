// -- Testing Imports --
import { describe, it, expect } from 'vitest';

// -- Utils Imports --
import { drawerDropFolderId } from './useCharacterSheetDnD';

// -- Type Imports --
import type { DragOverEvent } from '@dnd-kit/core';

/** A minimal `over` descriptor: only `data.current` is read by the resolver. */
function makeOver(data?: Record<string, unknown>): NonNullable<DragOverEvent['over']> {
   return { data: { current: data } } as unknown as NonNullable<DragOverEvent['over']>;
}

describe('drawerDropFolderId', () => {
   it('routes a folder-row drop into that folder', () => {
      expect(drawerDropFolderId('folder-123', 'drawer-folder', makeOver())).toBe('folder-123');
   });

   it('routes a folder items drop-zone into that folder', () => {
      expect(drawerDropFolderId('drawer-drop-zone-folder-123', 'drawer-item', makeOver())).toBe('folder-123');
   });

   it('routes the root items drop-zone to undefined (top level)', () => {
      expect(drawerDropFolderId('drawer-drop-zone-root', 'drawer-item', makeOver())).toBeUndefined();
   });

   it('routes a Back-button drop into its parent folder', () => {
      expect(drawerDropFolderId('drawer-back-button-x', 'drawer-back-button', makeOver({ destinationId: 'parent-9' }))).toBe('parent-9');
   });

   it('routes a Back button with no parent to undefined (root)', () => {
      expect(drawerDropFolderId('drawer-back-button-x', 'drawer-back-button', makeOver())).toBeUndefined();
   });

   it('returns undefined for a non-drawer target', () => {
      expect(drawerDropFolderId('board-drop-zone', 'board', makeOver())).toBeUndefined();
   });
});
