// -- Repository Imports --
import { getItem } from '@/lib/drawer/drawerRepository';
import { DRAWER_ROOT_PARENT_ID } from '@/lib/drawer/drawerRecords';

// -- Store Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

/*
 * The Portals reveal-in-drawer service: for a tabless ELEMENT link clicked inside a note open as a TAB,
 * it opens the drawer, navigates to the item's folder, and pulses the row - the drawer had folder nav +
 * search but no "open + scroll-to + highlight" affordance, so this composes it. App-global (not board
 * coupled), so it reaches the stores directly rather than riding a render-site callback; the pure
 * classify/resolve stays in `linkTarget.ts`, the thin dispatch in `runLinkAction.ts`.
 */

/** Dependencies the reveal needs: a dead-target notifier (a toast) for a deleted item. */
export interface RevealDrawerItemDeps {
   /** Called when the item id resolves to nothing (deleted / never saved) - the caller shows a toast. */
   onMissing: () => void;
}

/**
 * Reveals the drawer item `drawerItemId`: opens the drawer, clears any active search (the browse view is
 * where the row lives), navigates to the item's parent folder, then flags it for a one-shot scroll + pulse.
 * A deleted item calls `onMissing` and no-ops. Navigation is awaited before the highlight so the row is
 * already in the freshly-loaded folder view when the pulse fires.
 */
export async function revealDrawerItem(drawerItemId: string, deps: RevealDrawerItemDeps): Promise<void> {
   const item = await getItem(drawerItemId);
   if (!item) {
      deps.onMissing();
      return;
   }
   // The repository stores a root parent as the reserved sentinel; translate it back to the app's `null`.
   const parentFolderId = item.parentFolderId === DRAWER_ROOT_PARENT_ID ? null : item.parentFolderId;

   useAppGeneralStateStore.getState().actions.setDrawerOpen(true);
   const drawerActions = useDrawerStore.getState().actions;
   // A search view hides the browse folders, so the revealed row would be off-screen; drop it first.
   drawerActions.clearSearch();
   await drawerActions.setDrawerCurrentFolderId(parentFolderId);
   drawerActions.highlightItem(drawerItemId);
}
