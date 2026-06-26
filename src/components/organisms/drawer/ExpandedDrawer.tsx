// -- React Imports --
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AnimatePresence, motion } from 'framer-motion';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import cuid from 'cuid';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { ArrowLeft, ArrowUpToLine, ChevronsUp, Eye, Inbox, Minimize2, Plus } from 'lucide-react';

// -- Component Imports --
import { DrawerFolderEntry } from '@/components/molecules/drawer/DrawerFolderEntry';
import FolderDropZone from '@/components/molecules/drawer/FolderDropZone';
import { DrawerItemEntry } from '@/components/molecules/drawer/DrawerItemEntry';
import { DrawerCompactItemEntry } from '@/components/molecules/drawer/DrawerCompactItemEntry';
import { DrawerSearchResultEntry } from '@/components/molecules/drawer/DrawerSearchResultEntry';
import { DrawerSearchResultCard } from '@/components/molecules/drawer/DrawerSearchResultCard';
import { DrawerSortControl } from '@/components/molecules/drawer/DrawerSortControl';
import { DrawerHeader } from '@/components/molecules/drawer/DrawerHeader';
import { DrawerGridSkeleton } from '@/components/molecules/drawer/DrawerContentSkeleton';
import { DrawerModificationWindow } from '@/components/organisms/drawer/DrawerModificationWindow';
import { Breadcrumb } from '@/components/molecules/Breadcrumbs';

// -- Store and Hook Imports --
import { useDrawerActions, useDrawerStore, isSearchFilterActive } from '@/lib/stores/drawerStore';
import { useDrawerNavigation } from '@/hooks/drawer/useDrawerNavigation';
import { useDrawerActionState } from '@/hooks/drawer/useDrawerActionState';
import { useAppGeneralStateActions, useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { staticListSortingStrategy } from '@/lib/utils/dnd';
import { SPRING_HOLD_MS } from '@/lib/utils/dragFeedback';

/*
 * The Expanded drawer: a roomy library that takes over the workspace area (the TabStrip + sheet/board
 * stay mounted behind it). Folder nav down the side, items in a GRID, over the SAME drawerStore + search
 * as the Open side panel (shared search bar / sort / entries - this is a second layout, not a second
 * drawer). "Contract" returns to Open, "close" to Collapsed.
 *
 * See-Workspace: the workspace is hidden behind this overlay, so a drawer-item drag can't reach a
 * board/sheet. Dwelling the bottom strip RECEDES the overlay (slides it down, STAYS MOUNTED + pointer-
 * transparent) to reveal the workspace; the drop lands there; on drag end it slides back. The overlay
 * must never UNMOUNT mid-drag (dnd-kit cancels the drag if the dragged item's source node unmounts), so
 * the recede is a transform, not a conditional render. The re-expand edge is the out (dwell to return).
 */

interface ExpandedDrawerProps {
   /** A drawer ITEM (not folder) is being dragged: show the See-Workspace strip. */
   isItemDragActive: boolean;
   /** Which recede dwell is in progress ('see-workspace' | 'reexpand' | null), for the progress cue. */
   workspaceDwellKey: string | null;
   /** The dragged item/folder id + the dnd-kit `over` id, for the folder reorder slots (as in the side panel). */
   activeDragId: string | null;
   overDragId: string | null;
}

export function ExpandedDrawer({ isItemDragActive, workspaceDwellKey, activeDragId, overDragId }: ExpandedDrawerProps) {
   const { t } = useTranslation();
   // Receded = slid aside to reveal the workspace (set by the DnD layer's dwell); only true mid-drag.
   const isReceded = useAppGeneralStateStore((state) => state.isDrawerReceded);
   const {
      currentFolderId,
      navigateToFolder,
      currentItems,
      currentFolders,
      parentFolderId,
      breadcrumbPath,
      isContentLoading,
   } = useDrawerNavigation();

   const { reloadCurrentFolder, clearSearch } = useDrawerActions();
   const { contractDrawer, setDrawerOpen } = useAppGeneralStateActions();
   // The Library honors the SAME Rich/List toggle as the side panel (one shared setting, not a new flag).
   const isCompactDrawer = useAppSettingsStore((state) => state.isCompactDrawer);
   const { toggleCompactDrawer } = useAppSettingsActions();

   const searchResults = useDrawerStore((state) => state.searchResults);
   const isSearchActive = useDrawerStore((state) => isSearchFilterActive(state.searchCriteria));

   // Reorder scaffolding, mirroring the side panel: folder ids for the SortableContext, and the dragged
   // folder's index so the two no-op slots flanking it don't expand.
   const folderIds = useMemo(() => currentFolders.map((f) => f.id), [currentFolders]);
   const activeFolderIndex = useMemo(
      () => (activeDragId ? currentFolders.findIndex((f) => f.id === activeDragId) : -1),
      [activeDragId, currentFolders],
   );

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

   const isDwellingStrip = workspaceDwellKey === 'see-workspace';
   const isDwellingEdge = workspaceDwellKey === 'reexpand';

   // The right-anchored grow animates width to the parent's measured PIXEL width: framer can't tween
   // width between mixed units (25rem -> 100%), so it snaps; a px target tweens cleanly. Tracked live so
   // a sidebar collapse / viewport resize keeps the full extent correct.
   const overlayRef = useRef<HTMLDivElement>(null);
   const [fullWidth, setFullWidth] = useState<number | null>(null);
   useLayoutEffect(() => {
      const parent = overlayRef.current?.parentElement;
      if (!parent) return;
      const measure = () => setFullWidth(parent.clientWidth);
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(parent);
      return () => observer.disconnect();
   }, []);

   return (
      // The Library overlay sits over the whole top row (the workspace stays mounted behind it; the
      // sidebar is raised above it, so only the sidebar stays exposed). It GROWS IN from the right -
      // a continuous right-anchored expansion of the side drawer, so the side panel's removal and the
      // column reflow happen unseen beneath it, with no pop. One DndContext (the page's) spans
      // everything; this adds none. overflow-hidden clips the recede off-screen (no page scroll).
      <motion.div
         ref={overlayRef}
         className="pointer-events-none absolute inset-y-0 right-0 z-30 overflow-hidden"
         initial={{ width: '22rem' }}
         animate={{ width: fullWidth ?? '100%' }}
         // Exit depends on WHY it left (AnimatePresence's custom = isDrawerOpen at exit): CONTRACT (still
         // open) shrinks back toward the side-panel width, handing off to the entering side panel; CLOSE
         // (no longer open) slides fully off the right edge, revealing the workspace as it goes. Both are
         // right-anchored, matching the open/expand/contract motions - one drawer growing/shrinking/sliding.
         variants={{ exit: (open: boolean) => (open ? { width: '22rem' } : { x: '100%' }) }}
         exit="exit"
         transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
         {/* The Library surface. When receded it slides DOWN (clipped by the overlay above, so off-screen
             with no page scroll) and goes pointer-transparent, but STAYS MOUNTED so the live drag is never
             cancelled and the cursor reaches the revealed workspace. `data-drawer-panel` makes the in-drawer
             drop resolver treat the Library as the drawer panel (folder / current-folder targets), exactly
             as it does the side panel; receded slides it off-screen so the resolver stops matching it. */}
         <div data-drawer-panel className={cn(
            'pointer-events-auto relative flex h-full w-full flex-col bg-card transition-transform duration-300 ease-in-out',
            isReceded && 'translate-y-full',
         )}>
         {/* Shared header (identical to the side panel's) - only the mode button differs: Contract here. */}
         <DrawerHeader
            title={t('Drawer.title')}
            isCompactDrawer={isCompactDrawer}
            onToggleView={toggleCompactDrawer}
            modeIcon={<Minimize2 className="h-6 w-6" />}
            modeLabel={t('Drawer.contract')}
            onMode={contractDrawer}
            onClose={() => setDrawerOpen(false)}
         />

         <motion.div
            // Cross-fade the BODY across expand<->reduce: it fades in here (horizontal: folders left,
            // items right) after the vertical side-panel body has faded out, and fades out on contract -
            // the layout swap is never seen. The shared header above and the panel resize are untouched.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, delay: 0.1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="flex min-h-0 flex-1"
         >
            {/* Folder side-nav. Internal spacing/padding mirrors the side-panel Drawer's folder section
                (p-2 pt-0; the inter-folder rhythm comes from the reorder slots, not a flat gap), so the
                two read identically; only the column chrome (w-64, border, bg-popover) is Library-specific. */}
            <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r-2 border-border bg-popover p-2 pt-0">
               {breadcrumbPath.length > 0 && (
                  <div className="mt-2 mb-1 flex items-center gap-2">
                     <div onClick={() => navigateToFolder(null)} className="shrink-0 cursor-pointer rounded p-1 hover:bg-muted" role="button" aria-label={t('Drawer.backToRoot')}>
                        <ArrowUpToLine className="h-4 w-4" />
                     </div>
                     <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />
                  </div>
               )}

               {currentFolderId && (
                  <div onClick={() => navigateToFolder(parentFolderId)} className="relative flex h-10 cursor-pointer items-center gap-2 rounded bg-card p-2 mt-2 hover:bg-muted transition-colors" role="button">
                     <ArrowLeft className="h-5 w-5" />
                     <span className="text-sm font-medium">{t('Drawer.Actions.moveUp')}</span>
                  </div>
               )}

               {/* Folders render from the in-memory cache - present instantly on navigation, no skeleton. */}
               {currentFolders.length > 0 && (
                  // Folders reorder via the same expanding-slot mechanism as the side panel (static rows,
                  // a thin constant gap between them that becomes the drop target during a folder drag).
                  <SortableContext items={folderIds} strategy={staticListSortingStrategy}>
                     {currentFolders.map((folder, index) => (
                        <React.Fragment key={folder.id}>
                           <FolderDropZone
                              id={`drop-zone-before-${folder.id}`}
                              activeId={activeDragId}
                              overId={overDragId}
                              canExpand={activeFolderIndex !== -1 && index !== activeFolderIndex && index !== activeFolderIndex + 1}
                              data={{ type: 'drawer-drop-zone', targetId: folder.id, position: 'before' }}
                           />
                           <DrawerFolderEntry
                              folder={folder}
                              parentFolderId={currentFolderId}
                              isOver={false}
                              onNavigate={navigateToFolder}
                              onRename={() => setActiveAction({ id: cuid(), type: 'rename-folder', target: folder })}
                              onDelete={() => setActiveAction({ id: cuid(), type: 'delete-folder', target: folder })}
                              onMove={() => setActiveAction({ id: cuid(), type: 'move-folder', target: folder })}
                           />
                        </React.Fragment>
                     ))}
                     <FolderDropZone
                        id={`drop-zone-after-last`}
                        activeId={activeDragId}
                        overId={overDragId}
                        canExpand={activeFolderIndex !== -1 && activeFolderIndex !== currentFolders.length - 1}
                        data={{ type: 'drawer-drop-zone', targetId: 'last', position: 'after' }}
                     />
                  </SortableContext>
               )}

               <div className="mt-1 rounded border-2 border-dashed border-border bg-card">
                  <Button variant="ghost" className="w-full cursor-pointer justify-start" onClick={handleAddFolder}>
                     <Plus className="mr-2 h-4 w-4" />
                     {t('Drawer.addFolder')}
                  </Button>
               </div>
            </aside>

            {/* Item area: a responsive grid of items (browse) or search results. */}
            <main className="relative flex-1 overflow-y-auto bg-popover p-4">
               {isSearchActive ? (
                  <div className="flex flex-col gap-3">
                     <DrawerSortControl />
                     {searchResults && searchResults.length > 0 ? (
                        // Rich -> a grid of lazy rich cards; List -> a single column of light rows.
                        <div className={isCompactDrawer ? 'flex flex-col gap-2' : 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3'}>
                           {searchResults.map((summary) => {
                              const resultProps = {
                                 summary,
                                 onJumpTo: () => handleJumpToResult(summary.parentFolderId),
                                 onRename: () => setActiveAction({ id: cuid(), type: 'rename-item', target: summary }),
                                 onDelete: () => setActiveAction({ id: cuid(), type: 'delete-item', target: summary }),
                                 onMove: () => setActiveAction({ id: cuid(), type: 'move-item', target: summary }),
                              };
                              return isCompactDrawer
                                 ? <DrawerSearchResultEntry key={summary.id} {...resultProps} />
                                 : <DrawerSearchResultCard key={summary.id} {...resultProps} />;
                           })}
                        </div>
                     ) : (
                        <EmptyState message={t('Drawer.search.noMatches')} />
                     )}
                  </div>
               ) : isContentLoading ? (
                  // Navigating to a new folder: a grid of card placeholders instead of the stale items.
                  <DrawerGridSkeleton compact={isCompactDrawer} />
               ) : currentItems.length > 0 ? (
                  // Rich -> a grid of uniform cards; List -> a single column of rows (same toggle as the side panel).
                  // Items reorder via the grid live-shuffle (rectSortingStrategy); the `over` is resolved from
                  // live geometry in customCollisionDetection so the workspace behind never intercepts.
                  <SortableContext items={currentItems.map((item) => item.id)} strategy={rectSortingStrategy}>
                     <div data-drawer-items-area className={isCompactDrawer ? 'flex flex-col gap-1' : 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3'}>
                        {currentItems.map((item) => {
                           const commonProps = {
                              item,
                              parentFolderId: currentFolderId,
                              onRename: () => setActiveAction({ id: cuid(), type: 'rename-item', target: item }),
                              onDelete: () => setActiveAction({ id: cuid(), type: 'delete-item', target: item }),
                              onMove: () => setActiveAction({ id: cuid(), type: 'move-item', target: item }),
                           };
                           return isCompactDrawer
                              ? <DrawerCompactItemEntry key={item.id} {...commonProps} />
                              : <DrawerItemEntry key={item.id} {...commonProps} />;
                        })}
                     </div>
                  </SortableContext>
               ) : (
                  <EmptyState message={t('Drawer.emptyFolder')} />
               )}
            </main>
         </motion.div>

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

         {/* See-Workspace strip: appears at the bottom only during a drawer-item drag (not yet receded).
             Dwelling it recedes the overlay (handled by the DnD layer's geometry dwell). The fill grows
             over the hold while dwelling - the progress cue. */}
         {isItemDragActive && !isReceded && (
            <div
               data-see-workspace
               className="absolute inset-x-0 bottom-0 z-40 flex h-16 items-center justify-center gap-2 overflow-hidden border-t-2 border-primary/50 bg-primary/10 text-sm font-semibold text-foreground"
            >
               <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-primary/25 ease-linear"
                  style={{ width: isDwellingStrip ? '100%' : '0%', transition: `width ${isDwellingStrip ? SPRING_HOLD_MS : 0}ms linear` }}
               />
               <Eye className="relative h-5 w-5" />
               <span className="relative">{t('Drawer.seeWorkspace')}</span>
            </div>
         )}
         </div>

         {/* Re-expand edge: a SIBLING of the recede surface (NOT transformed), so it stays put +
             interactive at the bottom while the Library slides away. Dwelling it re-expands without
             dropping - the out for an accidental recede. Only present while receded (mid-drag). */}
         {isReceded && (
            <div
               data-reexpand-drawer
               className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex h-12 items-center justify-center gap-2 overflow-hidden border-t-2 border-primary/50 bg-background/95 text-sm font-semibold text-foreground"
            >
               <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-primary/25 ease-linear"
                  style={{ width: isDwellingEdge ? '100%' : '0%', transition: `width ${isDwellingEdge ? SPRING_HOLD_MS : 0}ms linear` }}
               />
               <ChevronsUp className="relative h-5 w-5" />
               <span className="relative">{t('Drawer.reexpand')}</span>
            </div>
         )}
      </motion.div>
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
