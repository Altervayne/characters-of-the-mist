// -- React Imports --
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AnimatePresence, motion } from 'framer-motion';
import cuid from 'cuid';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { ArrowLeft, ArrowUpToLine, Inbox, Minimize2, Plus, PanelRightClose } from 'lucide-react';

// -- Component Imports --
import { DrawerFolderEntry } from '@/components/molecules/drawer/DrawerFolderEntry';
import { DrawerItemEntry } from '@/components/molecules/drawer/DrawerItemEntry';
import { DrawerSearchResultEntry } from '@/components/molecules/drawer/DrawerSearchResultEntry';
import { DrawerSearchBar } from '@/components/molecules/drawer/DrawerSearchBar';
import { DrawerSortControl } from '@/components/molecules/drawer/DrawerSortControl';
import { DrawerModificationWindow } from '@/components/organisms/drawer/DrawerModificationWindow';
import { Breadcrumb } from '@/components/molecules/Breadcrumbs';

// -- Store and Hook Imports --
import { useDrawerActions, useDrawerStore, isSearchFilterActive } from '@/lib/stores/drawerStore';
import { useDrawerNavigation } from '@/hooks/drawer/useDrawerNavigation';
import { useDrawerActionState } from '@/hooks/drawer/useDrawerActionState';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

/*
 * The Expanded drawer: a roomy library that takes over the workspace area (the TabStrip + sheet/board
 * stay mounted behind it - phase 5's "See Workspace" recedes this overlay). Folder nav down the side,
 * items in a GRID, over the SAME drawerStore + search as the Open side panel (shared search bar / sort
 * / entries - this is a second layout, not a second drawer). Browse / search / navigate only; drag is
 * deferred (a reused item entry's reorder is inert here). "Contract" returns to Open, "close" to Collapsed.
 */

export function ExpandedDrawer() {
   const { t } = useTranslation();
   const {
      currentFolderId,
      navigateToFolder,
      currentItems,
      currentFolders,
      parentFolderId,
      breadcrumbPath,
   } = useDrawerNavigation();

   const { reloadCurrentFolder, clearSearch } = useDrawerActions();
   const { contractDrawer, setDrawerOpen } = useAppGeneralStateActions();

   const searchResults = useDrawerStore((state) => state.searchResults);
   const isSearchActive = useDrawerStore((state) => isSearchFilterActive(state.searchCriteria));

   const {
      activeAction,
      setActiveAction,
      inputRef,
      handleAddFolder,
      handleConfirmAction,
      handleCloseModificationWindow,
      handleAnimationComplete,
   } = useDrawerActionState(currentFolderId);

   // The store loads on demand; refresh the current-folder view when the Expanded view mounts.
   useEffect(() => {
      void reloadCurrentFolder();
   }, [reloadCurrentFolder]);

   const handleJumpToResult = (folderId: string | null) => {
      navigateToFolder(folderId);
      clearSearch();
   };

   return (
      // Overlay covering the main content area (the workspace stays mounted behind it). One DndContext
      // (the page's) still spans everything - this adds none.
      <div className="absolute inset-0 z-30 flex flex-col bg-background">
         {/* Header: title, the shared search bar, contract + close. */}
         <header className="shrink-0 border-b-2 border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
               <h2 className="text-xl font-bold">{t('Drawer.expandedTitle')}</h2>
               <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="cursor-pointer gap-2" onClick={contractDrawer} title={t('Drawer.contract')}>
                     <Minimize2 className="h-5 w-5" />
                     {t('Drawer.contract')}
                  </Button>
                  <div onClick={() => setDrawerOpen(false)} className="cursor-pointer rounded p-2 hover:bg-muted" role="button" aria-label={t('Drawer.close')}>
                     <PanelRightClose className="h-6 w-6" />
                  </div>
               </div>
            </div>
            <div className="mx-auto max-w-2xl">
               <DrawerSearchBar />
            </div>
         </header>

         <div className="flex min-h-0 flex-1">
            {/* Folder side-nav. */}
            <aside className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r-2 border-border bg-popover p-3">
               {breadcrumbPath.length > 0 && (
                  <div className="mb-1 flex items-center gap-2">
                     <div onClick={() => navigateToFolder(null)} className="shrink-0 cursor-pointer rounded p-1 hover:bg-muted" role="button" aria-label={t('Drawer.backToRoot')}>
                        <ArrowUpToLine className="h-4 w-4" />
                     </div>
                     <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />
                  </div>
               )}

               {currentFolderId && (
                  <div onClick={() => navigateToFolder(parentFolderId)} className="flex h-10 cursor-pointer items-center gap-2 rounded bg-card p-2 hover:bg-muted" role="button">
                     <ArrowLeft className="h-5 w-5" />
                     <span className="text-sm font-medium">{t('Drawer.Actions.moveUp')}</span>
                  </div>
               )}

               {currentFolders.map((folder) => (
                  <DrawerFolderEntry
                     key={folder.id}
                     folder={folder}
                     parentFolderId={currentFolderId}
                     isOver={false}
                     onNavigate={navigateToFolder}
                     onRename={() => setActiveAction({ id: cuid(), type: 'rename-folder', target: folder })}
                     onDelete={() => setActiveAction({ id: cuid(), type: 'delete-folder', target: folder })}
                     onMove={() => setActiveAction({ id: cuid(), type: 'move-folder', target: folder })}
                  />
               ))}

               <div className="mt-1 rounded border-2 border-dashed border-border bg-card">
                  <Button variant="ghost" className="w-full cursor-pointer justify-start" onClick={handleAddFolder}>
                     <Plus className="mr-2 h-4 w-4" />
                     {t('Drawer.addFolder')}
                  </Button>
               </div>
            </aside>

            {/* Item area: a responsive grid of items (browse) or search results. */}
            <main className="relative flex-1 overflow-y-auto p-4">
               {isSearchActive ? (
                  <div className="flex flex-col gap-3">
                     <DrawerSortControl />
                     {searchResults && searchResults.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                           {searchResults.map((summary) => (
                              <DrawerSearchResultEntry
                                 key={summary.id}
                                 summary={summary}
                                 onJumpTo={() => handleJumpToResult(summary.parentFolderId)}
                                 onRename={() => setActiveAction({ id: cuid(), type: 'rename-item', target: summary })}
                                 onDelete={() => setActiveAction({ id: cuid(), type: 'delete-item', target: summary })}
                                 onMove={() => setActiveAction({ id: cuid(), type: 'move-item', target: summary })}
                              />
                           ))}
                        </div>
                     ) : (
                        <EmptyState message={t('Drawer.search.noMatches')} />
                     )}
                  </div>
               ) : currentItems.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                     {currentItems.map((item) => (
                        <DrawerItemEntry
                           key={item.id}
                           item={item}
                           parentFolderId={currentFolderId}
                           onRename={() => setActiveAction({ id: cuid(), type: 'rename-item', target: item })}
                           onDelete={() => setActiveAction({ id: cuid(), type: 'delete-item', target: item })}
                           onMove={() => setActiveAction({ id: cuid(), type: 'move-item', target: item })}
                        />
                     ))}
                  </div>
               ) : (
                  <EmptyState message={t('Drawer.emptyFolder')} />
               )}
            </main>
         </div>

         {/* The modification window (rename / delete / move / add-folder), as in the side panel. */}
         {activeAction && <div className="absolute inset-0 bg-black/40" />}
         <AnimatePresence>
            {activeAction && (
               <motion.div
                  key={activeAction.id}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                  onAnimationComplete={handleAnimationComplete}
                  className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-md"
               >
                  <DrawerModificationWindow
                     ref={inputRef}
                     action={activeAction}
                     onClose={handleCloseModificationWindow}
                     onConfirm={handleConfirmAction}
                  />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
}

/** A centered empty-state for an empty folder or no search matches. */
function EmptyState({ message }: { message: string }) {
   return (
      <div className="flex h-full flex-col items-center justify-center py-8 text-center">
         <Inbox className="mx-auto h-16 w-16 text-muted-foreground" />
         <p className="mt-2 text-lg text-muted-foreground">{message}</p>
      </div>
   );
}
