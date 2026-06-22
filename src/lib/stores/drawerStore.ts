// -- Other Library Imports --
import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';

// -- Utils Imports --
import { deepReId } from '../utils/drawer';

// -- Drawer Data Layer Imports --
import { getBreadcrumbPath, getChildCountsForFolders, getFolderChildren } from '@/lib/drawer/drawerRepository';
import {
   createCreateFolderCommand,
   createCreateItemCommand,
   createDeleteFolderCommand,
   createDeleteItemCommand,
   createImportDrawerAsFolderCommand,
   createImportFolderCommand,
   createMoveFolderCommand,
   createMoveItemCommand,
   createRenameFolderCommand,
   createRenameItemCommand,
   createReorderFoldersCommand,
   createReorderItemsCommand,
   createUpdateItemContentCommand,
   drawerCommandEngine,
} from '@/lib/drawer/drawerCommandEngine';

// -- Store and Hook Imports --
import { useAppGeneralStateStore } from './appGeneralStateStore';

// -- Type Imports --
import type { DrawerCommand } from '@/lib/drawer/drawerCommandEngine';
import type { DrawerFolderRecord, DrawerItemRecord } from '@/lib/drawer/drawerRecords';
import type { Drawer, Folder, DrawerItemContent, GeneralItemType, GameSystem } from '@/lib/types/drawer';

/*
 * Drawer store - the React-facing facade over the normalized Dexie repository and
 * the command/undo engine. The store no longer holds the whole drawer tree, nor
 * zustand `persist`/`temporal`: its state is the loaded view of the *current folder*
 * plus flags, and its actions are async - each dispatches a command through the
 * engine, then explicitly re-queries the current folder. Action names are kept
 * aligned with the old store so consumers change only by adding `await`.
 */

/**
 * A sheet item queued to be dropped into the drawer (named via the modification
 * window before it becomes a real item). Kept verbatim from the old store,
 * including `presetId` (used to link a loaded character to its drawer item id).
 */
export interface PendingDrawerItem {
   game: GameSystem;
   type: GeneralItemType;
   content: DrawerItemContent;
   parentFolderId?: string;
   defaultName: string;
   presetId?: string;
}

/** The loaded view of the current folder. `null` until the first load completes. */
export interface DrawerCurrentFolderView {
   folders: DrawerFolderRecord[];
   items: DrawerItemRecord[];
   /** Direct child counts keyed by child-folder id, for rendering folder summary rows. */
   childCounts: Map<string, { folderCount: number; itemCount: number }>;
}

/** A repository/engine error surfaced to the UI (toasts are raised by the calling hooks). */
export interface DrawerStoreError {
   code: string;
   message: string;
}

export interface DrawerState {
   currentFolderId: string | null;
   currentFolderView: DrawerCurrentFolderView | null;
   breadcrumbPath: DrawerFolderRecord[];
   parentFolderId: string | null;
   isLoading: boolean;
   error: DrawerStoreError | null;
   pendingItem: PendingDrawerItem | null;
   canUndo: boolean;
   canRedo: boolean;
   actions: {
      // Drawer-level
      importDrawerAsFolder: (newDrawer: Drawer, folderName: string) => Promise<void>;
      // Folder actions
      addFolder: (name: string, parentFolderId?: string) => Promise<string>;
      addImportedFolder: (folder: Folder, parentFolderId?: string) => Promise<void>;
      renameFolder: (folderId: string, newName: string) => Promise<void>;
      deleteFolder: (folderId: string) => Promise<void>;
      moveFolder: (folderId: string, destinationFolderId?: string) => Promise<void>;
      reorderFolders: (parentFolderId: string | null, oldIndex: number, newIndex: number) => Promise<void>;
      // Item actions
      addItem: (name: string, game: GameSystem, type: GeneralItemType, content: DrawerItemContent, parentFolderId?: string) => Promise<string>;
      addImportedItem: (itemContent: DrawerItemContent, itemType: GeneralItemType, game: GameSystem, parentFolderId?: string) => Promise<void>;
      renameItem: (itemId: string, newName: string) => Promise<void>;
      deleteItem: (itemId: string) => Promise<void>;
      moveItem: (itemId: string, destinationFolderId?: string) => Promise<void>;
      reorderItems: (parentFolderId: string | null, oldIndex: number, newIndex: number) => Promise<void>;
      updateItem: (itemId: string, newContent: DrawerItemContent, newName?: string) => Promise<void>;
      // Drop flow
      initiateItemDrop: (itemInfo: PendingDrawerItem) => void;
      clearPendingItemDrop: () => void;
      // Navigation + view
      setDrawerCurrentFolderId: (id: string | null) => Promise<void>;
      reloadCurrentFolder: () => Promise<void>;
      // Undo / redo (drive the command engine; mirrored into canUndo/canRedo)
      undoDrawer: () => Promise<void>;
      redoDrawer: () => Promise<void>;
   };
}

const initialState: Pick<
   DrawerState,
   'currentFolderId' | 'currentFolderView' | 'breadcrumbPath' | 'parentFolderId' | 'isLoading' | 'error' | 'pendingItem' | 'canUndo' | 'canRedo'
> = {
   currentFolderId: null,
   currentFolderView: null,
   breadcrumbPath: [],
   parentFolderId: null,
   isLoading: false,
   error: null,
   pendingItem: null,
   canUndo: false,
   canRedo: false,
};

/** Normalizes a thrown value into the store's `{ code, message }` error shape. */
function toStoreError(error: unknown): DrawerStoreError {
   const message = error instanceof Error ? error.message : String(error);
   if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
      return { code: (error as { code: string }).code, message };
   }
   return { code: 'UNKNOWN', message };
}

/** Marks the drawer as the most recently modified store, so Ctrl/Cmd+Z routes here. */
function markDrawerModified(): void {
   useAppGeneralStateStore.getState().actions.setLastModifiedStore('drawer');
}

export const useDrawerStore = create<DrawerState>()((set, get) => {
   /**
    * Loads the view for a folder (`null` = root): its ordered children, breadcrumb
    * trail, parent id, and child-folder counts. Sets `isLoading`/`error`; never
    * throws (errors land in `error` state for the UI to surface).
    */
   const loadView = async (folderId: string | null): Promise<void> => {
      set({ isLoading: true, error: null });
      try {
         const { folders, items } = await getFolderChildren(folderId);
         const breadcrumbPath = await getBreadcrumbPath(folderId);
         const childCounts = await getChildCountsForFolders(folders.map((folder) => folder.id));
         // The parent of the current folder is the breadcrumb entry before it
         // (root when the current folder is top-level or the root itself).
         const parentFolderId = breadcrumbPath.length >= 2 ? breadcrumbPath[breadcrumbPath.length - 2].id : null;
         set({ currentFolderView: { folders, items, childCounts }, breadcrumbPath, parentFolderId, isLoading: false });
      } catch (error) {
         set({ isLoading: false, error: toStoreError(error) });
      }
   };

   /**
    * Runs a mutation: marks the drawer modified, executes the command through the
    * engine, then re-queries the current folder. On engine failure it records the
    * error and rethrows (so the calling hook can branch / toast); a later view
    * reload failure is captured in `error` without throwing.
    */
   const runMutation = async (command: DrawerCommand): Promise<void> => {
      markDrawerModified();
      try {
         await drawerCommandEngine.execute(command);
      } catch (error) {
         set({ error: toStoreError(error) });
         throw error;
      }
      await loadView(get().currentFolderId);
   };

   return {
      ...initialState,
      actions: {
         // ==================
         //  Drawer-level
         // ==================
         importDrawerAsFolder: async (newDrawer, folderName) => {
            await runMutation(createImportDrawerAsFolderCommand(newDrawer, folderName, null));
         },

         // ==================
         //  Folder actions
         // ==================
         addFolder: async (name, parentFolderId) => {
            const command = createCreateFolderCommand({ name, parentFolderId: parentFolderId ?? null });
            await runMutation(command);
            return command.getCreatedFolderId() ?? '';
         },
         addImportedFolder: async (folder, parentFolderId) => {
            await runMutation(createImportFolderCommand(folder, parentFolderId ?? null));
         },
         renameFolder: async (folderId, newName) => {
            await runMutation(createRenameFolderCommand(folderId, newName));
         },
         deleteFolder: async (folderId) => {
            await runMutation(createDeleteFolderCommand(folderId));
         },
         moveFolder: async (folderId, destinationFolderId) => {
            // Optimistic: the moved folder leaves the current view, so
            // drop it from the loaded folders immediately; the command then persists the
            // move and the reload confirms it. On failure, reload to the real order.
            const view = get().currentFolderView;
            if (view) set({ currentFolderView: { ...view, folders: view.folders.filter((folder) => folder.id !== folderId) } });
            try {
               await runMutation(createMoveFolderCommand(folderId, destinationFolderId ?? null));
            } catch (error) {
               await loadView(get().currentFolderId);
               set({ error: toStoreError(error) });
               throw error;
            }
         },
         reorderFolders: async (parentFolderId, oldIndex, newIndex) => {
            // Optimistic: reflect the new order in the loaded view at once
            // so the row lands where released, no wait for the command + reload. The
            // engine reorders with the same arrayMove semantics, so the reload is a no-op
            // visually; on failure, reload to revert to the persisted truth.
            const view = get().currentFolderView;
            if (view) set({ currentFolderView: { ...view, folders: arrayMove(view.folders, oldIndex, newIndex) } });
            try {
               await runMutation(createReorderFoldersCommand(parentFolderId, oldIndex, newIndex));
            } catch (error) {
               await loadView(get().currentFolderId);
               set({ error: toStoreError(error) });
               throw error;
            }
         },

         // ==================
         //  Item actions
         // ==================
         addItem: async (name, game, type, content, parentFolderId) => {
            // Preserve the old store's semantics: a caller-preset id from the
            // content's `drawerItemId` becomes the item id, and the content is
            // deep-re-ID'd so the drawer copy is independent of the live source.
            // `deepReId` regenerates `id` fields only, leaving `drawerItemId`
            // intact, so the preset id still matches the stored content.
            const presetId = 'drawerItemId' in content && content.drawerItemId ? (content.drawerItemId as string) : undefined;
            // A FULL_BOARD aggregate must NOT be re-ID'd: its item ids are referenced by
            // connection endpoints (`from`/`to`) and its board id keys the focus-or-open
            // round-trip, so re-iding would orphan connections and change identity. Other
            // content stays re-ID'd so the drawer copy is independent of the live source.
            const freshContent = type === 'FULL_BOARD' ? content : deepReId(content);
            const command = createCreateItemCommand({ id: presetId, name, game, type, content: freshContent, parentFolderId: parentFolderId ?? null });
            await runMutation(command);
            return command.getCreatedItemId() ?? '';
         },
         addImportedItem: async (itemContent, itemType, game, parentFolderId) => {
            const freshContent = deepReId(itemContent);
            const name = 'title' in freshContent ? freshContent.title : freshContent.name;
            await runMutation(createCreateItemCommand({ name, game, type: itemType, content: freshContent, parentFolderId: parentFolderId ?? null }));
         },
         renameItem: async (itemId, newName) => {
            await runMutation(createRenameItemCommand(itemId, newName));
         },
         deleteItem: async (itemId) => {
            await runMutation(createDeleteItemCommand(itemId));
         },
         moveItem: async (itemId, destinationFolderId) => {
            // Optimistic: the moved item leaves the current view, so drop
            // it from the loaded items immediately; the command persists the move and the
            // reload confirms it. On failure, reload to restore the real view.
            const view = get().currentFolderView;
            if (view) set({ currentFolderView: { ...view, items: view.items.filter((item) => item.id !== itemId) } });
            try {
               await runMutation(createMoveItemCommand(itemId, destinationFolderId ?? null));
            } catch (error) {
               await loadView(get().currentFolderId);
               set({ error: toStoreError(error) });
               throw error;
            }
         },
         reorderItems: async (parentFolderId, oldIndex, newIndex) => {
            // Optimistic: reflect the new order in the loaded view at once
            // so the row lands where released, no wait for the command + reload. The
            // engine reorders with the same arrayMove semantics, so the reload is a no-op
            // visually; on failure, reload to revert to the persisted truth.
            const view = get().currentFolderView;
            if (view) set({ currentFolderView: { ...view, items: arrayMove(view.items, oldIndex, newIndex) } });
            try {
               await runMutation(createReorderItemsCommand(parentFolderId, oldIndex, newIndex));
            } catch (error) {
               await loadView(get().currentFolderId);
               set({ error: toStoreError(error) });
               throw error;
            }
         },
         updateItem: async (itemId, newContent, newName) => {
            await runMutation(createUpdateItemContentCommand(itemId, newContent, newName));
         },

         // ==================
         //  Drop flow (synchronous, unchanged)
         // ==================
         initiateItemDrop: (itemInfo) => {
            set({ pendingItem: itemInfo });
         },
         clearPendingItemDrop: () => {
            set({ pendingItem: null });
         },

         // ==================
         //  Navigation + view
         // ==================
         setDrawerCurrentFolderId: async (id) => {
            set({ currentFolderId: id });
            await loadView(id);
         },
         reloadCurrentFolder: async () => {
            await loadView(get().currentFolderId);
         },

         // ==================
         //  Undo / redo (engine-backed, navigation-independent)
         // ==================
         undoDrawer: async () => {
            await drawerCommandEngine.undo();
            await loadView(get().currentFolderId);
         },
         redoDrawer: async () => {
            await drawerCommandEngine.redo();
            await loadView(get().currentFolderId);
         },
      },
   };
});

/** Selector for the drawer action bag (stable reference). */
export const useDrawerActions = () => useDrawerStore((state) => state.actions);

// Mirror the command engine's undo/redo availability into the store so the UI can
// read `canUndo`/`canRedo` reactively. The engine notifies on execute/undo/redo/
// clear; commands operate by id, so this is independent of the current folder.
drawerCommandEngine.subscribe(() => {
   useDrawerStore.setState({ canUndo: drawerCommandEngine.canUndo(), canRedo: drawerCommandEngine.canRedo() });
});
