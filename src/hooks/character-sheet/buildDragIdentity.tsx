// -- React Imports --
import type { ReactNode } from 'react';

// -- Other Library Imports --
import type { DragStartEvent } from '@dnd-kit/core';
import { Folder as FolderIcon } from 'lucide-react';

// -- Component Imports --
import { DragIdentityPill } from '@/components/molecules/DragIdentityPill';

// -- Store Imports --
import { getOrCreateInstance } from '@/lib/character/characterStoreRegistry';

// -- Utils Imports --
import { getItemTypeIconComponent } from '@/lib/utils/drawer-icons';
import { mapItemToStorableInfo } from '@/lib/utils/dnd';

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
 * polish-9/10). This is the CONSUMER's job, the engine takes the result opaquely,
 * so the crest / type-icon lookup stays out of the engine. Each kind gets a leading
 * mark that says *what* it is: a game crest for characters/tabs, the drawer
 * item-type icon for components, a folder icon for folders, and the card/tracker
 * type icon for sheet items. Returns null where a pill would be noise (no name).
 *
 * @param params - The drag kind, the active descriptor, an optional sheet item, and
 *   the untitled fallback label.
 * @returns The identity {@link ReactNode}, or null when none should show.
 */
export function buildDragIdentity({ kind, active, sheetItem, untitledLabel }: BuildDragIdentityParams): ReactNode {
   if (kind === 'tab') {
      const character = getOrCreateInstance(String(active.id)).getState().character;
      // A tab is a character: crest from its resolved game.
      return <DragIdentityPill game={character?.game ?? null} label={character?.name?.trim() || untitledLabel} />;
   }

   if (kind === 'drawer-character' || kind === 'drawer-component' || kind === 'drawer-folder') {
      const item = active.data.current?.item as DrawerItem | Folder | undefined;
      const label = item?.name?.trim();
      if (!label) return null;
      if (kind === 'drawer-character') return <DragIdentityPill game={(item as DrawerItem).game} label={label} />;
      if (kind === 'drawer-folder') return <DragIdentityPill icon={FolderIcon} label={label} />;
      // drawer-component: lead with its drawer item-type icon.
      return <DragIdentityPill icon={getItemTypeIconComponent((item as DrawerItem).type)} label={label} />;
   }

   if (kind === 'sheet-item' && sheetItem) {
      const label = ('title' in sheetItem ? sheetItem.title : sheetItem.name)?.trim();
      if (!label) return null;
      // Lead with the card/tracker's drawer item-type icon (via its storable mapping).
      const storable = mapItemToStorableInfo(sheetItem);
      return <DragIdentityPill icon={storable ? getItemTypeIconComponent(storable[0]) : undefined} label={label} />;
   }

   return null;
}
