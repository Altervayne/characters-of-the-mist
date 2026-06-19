// -- React Imports --
import type { ReactNode } from 'react';

// -- Other Library Imports --
import type { DragStartEvent } from '@dnd-kit/core';

// -- Component Imports --
import { DragIdentityPill } from '@/components/molecules/DragIdentityPill';

// -- Store Imports --
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';

// -- Type Imports --
import type { DragKind } from '@/lib/utils/dragFeedback';
import type { DrawerItem, Folder } from '@/lib/types/drawer';
import type { Card, Tracker } from '@/lib/types/character';

/** Inputs for {@link buildDragIdentity}. */
interface BuildDragIdentityParams {
   /** The classified drag kind. */
   kind: DragKind;
   /** The @dnd-kit active descriptor (source of the dragged item's data). */
   active: DragStartEvent['active'];
   /** The resolved sheet card/tracker, supplied only for sheet-item drags. */
   sheetItem?: Card | Tracker | null;
   /** Fallback label for a tab whose character has no name yet. */
   untitledLabel: string;
}

/**
 * Builds the optional identity node for the drag-morph cluster's right pill (tabs
 * polish-9). This is the CONSUMER's job — the engine takes the result opaquely — so
 * the crest / `gameVisuals` lookup stays out of the engine. Returns the crest + name
 * for a drawer character, a name-only pill for components/folders/tabs/sheet items,
 * and null where a pill would be noise (no resolvable name).
 *
 * @param params - The drag kind, the active descriptor, an optional sheet item, and
 *   the untitled fallback label.
 * @returns The identity {@link ReactNode}, or null when none should show.
 */
export function buildDragIdentity({ kind, active, sheetItem, untitledLabel }: BuildDragIdentityParams): ReactNode {
   if (kind === 'tab') {
      const character = getOrCreateInstance(String(active.id)).getState().character;
      return <DragIdentityPill label={character?.name?.trim() || untitledLabel} />;
   }

   if (kind === 'drawer-character' || kind === 'drawer-component' || kind === 'drawer-folder') {
      const item = active.data.current?.item as DrawerItem | Folder | undefined;
      const label = item?.name?.trim();
      if (!label) return null;
      // Only a character carries a crest; everything else is name-only (tunable).
      if (kind === 'drawer-character') return <DragIdentityPill game={(item as DrawerItem).game} label={label} />;
      return <DragIdentityPill label={label} />;
   }

   if (kind === 'sheet-item' && sheetItem) {
      const label = ('title' in sheetItem ? sheetItem.title : sheetItem.name)?.trim();
      if (label) return <DragIdentityPill label={label} />;
   }

   return null;
}
