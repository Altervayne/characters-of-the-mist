// -- React Imports --
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AnimatePresence, motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import cuid from 'cuid';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Plus, ArrowLeft, Inbox, ArrowUpToLine, Download, Upload, LayoutGrid, Rows, PanelRightClose } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { staticListSortingStrategy } from '@/lib/utils/dnd';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Component Imports --
import { DrawerFolderEntry } from '@/components/molecules/drawer/DrawerFolderEntry';
import { DrawerItemEntry } from '@/components/molecules/drawer/DrawerItemEntry';
import { DrawerCompactItemEntry } from '@/components/molecules/drawer/DrawerCompactItemEntry';
import { DrawerModificationWindow } from '@/components/organisms/drawer/DrawerModificationWindow';
import { Breadcrumb } from '@/components/molecules/Breadcrumbs';
import FolderDropZone from '@/components/molecules/drawer/FolderDropZone';
import { DrawerUndoRedoControls } from '@/components/molecules/DrawerUndoRedoControls';

// -- Store and Hook Imports --
import { useDrawerNavigation } from '@/hooks/drawer/useDrawerNavigation';
import { useDrawerActionState } from '@/hooks/drawer/useDrawerActionState';
import { useDrawerFileImport } from '@/hooks/drawer/useDrawerFileImport';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { Variants } from 'framer-motion';


const drawerVariants: Variants = {
   initial: {
      width: 0,
   },
   animate: {
      width: "25rem",
   },
   exit: {
      width: 0,
   },
};

const contentVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { delay: 0.1, duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};


export function Drawer({ isDragHovering, activeDragId, overDragId }: { isDragHovering : boolean, activeDragId: string | null, overDragId: string | null; }) {
   const { t: t } = useTranslation();
   const { t: tActions } = useTranslation()

   const {
      currentFolderId,
      navigateToFolder,
      currentItems,
      currentFolders,
      parentFolderId,
      breadcrumbPath,
   } = useDrawerNavigation();

   const {
      activeAction,
      setActiveAction,
      inputRef,
      handleAddFolder,
      handleConfirmAction,
      handleCloseModificationWindow,
      handleAnimationComplete,
   } = useDrawerActionState(currentFolderId);

   const {
      getRootProps,
      isDragActive,
      handleFileSelected,
      handleExportDrawer,
      formRef,
      fileInputRef,
   } = useDrawerFileImport(currentFolderId);


   const isCompactDrawer = useAppSettingsStore((state) => state.isCompactDrawer);
   const { toggleCompactDrawer } = useAppSettingsActions();
   const { setDrawerOpen } = useAppGeneralStateActions();


   const folderIds = useMemo(() => currentFolders.map(f => f.id), [currentFolders]);
   const activeFolderIndex = useMemo(() => {
      if (!activeDragId) return -1;
      return currentFolders.findIndex(f => f.id === activeDragId);
   }, [activeDragId, currentFolders]);

   const droppableId = `drawer-drop-zone-${currentFolderId || 'root'}`;
   const { setNodeRef } = useDroppable({id: droppableId});

   const { setNodeRef: backButtonRef, isOver: isOverBackButton } = useDroppable({
      id: `drawer-back-button-${currentFolderId}`,
      data: {
         type: DRAG_TYPES.DRAWER_BACK_BUTTON,
         destinationId: parentFolderId,
      },
      disabled: !currentFolderId,
   });


   return (
      <motion.aside
         data-tour="drawer"
         variants={drawerVariants}
         initial="initial"
         animate="animate"
         exit="exit"
         className="bg-card border-l-2 border-border h-full flex flex-col overflow-hidden"
      >
         <div {...getRootProps()} className="relative w-100 h-full">

            <div className="relative w-100 h-full">
               <motion.div
                  variants={contentVariants}
                  className="w-full p-0 h-full flex flex-col"
               >
                     <header className="shrink-0 p-4 h-26 border-b-2 border-border">
                        <div className="flex grow h-8 items-center justify-between my-2">
                           <h2 className="flex-1 text-xl font-bold">{t('Drawer.title')}</h2>
                           <div className="flex-2">
                              <DrawerUndoRedoControls/>
                           </div>
                           <div className="flex-1 flex items-center justify-end gap-1">
                              <div onClick={toggleCompactDrawer} className="rounded p-2 hover:bg-muted cursor-pointer" role="button" aria-label={t('Drawer.toggleView')} data-tour="drawer-rich-view-toggle">
                                 {isCompactDrawer ? <LayoutGrid className="h-6 w-6" /> : <Rows className="h-6 w-6" />}
                              </div>
                              <div onClick={() => setDrawerOpen(false)} className="rounded p-2 hover:bg-muted cursor-pointer" role="button" aria-label="Close drawer">
                                 <PanelRightClose className="h-6 w-6" />
                              </div>
                           </div>
                        </div>

                        {breadcrumbPath.length > 0 && (
                           <div className="flex items-center gap-2 mt-2">
                              <div onClick={() => navigateToFolder(null)} className="rounded p-1 hover:bg-muted cursor-pointer shrink-0" role="button" aria-label="Back to root">
                                 <ArrowUpToLine className="h-4 w-4" />
                              </div>
                              <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />
                           </div>
                        )}
                     </header>

                     <div className="grow bg-popover overflow-y-auto flex flex-col">
                        <motion.div data-tour="drawer-folders" layout transition={{ duration: 0.1 }} className="flex flex-col w-full px-4 py-3 border-b-2 border-border overflow-hidden shrink-0">
                           {currentFolderId && (
                              <motion.div
                                 layout
                                 transition={{ duration: 0.1 }}
                                 ref={backButtonRef}
                                 onClick={() => navigateToFolder(parentFolderId)}
                                 className={cn(
                                    'flex h-10 items-center gap-2 p-2 bg-card rounded hover:bg-muted cursor-pointer mb-2 transition-colors',
                                    { 'bg-muted': isOverBackButton && activeDragId }
                                 )}
                                 role="button"
                              >
                                 <ArrowLeft className="h-5 w-5" />
                                 <span className="font-medium text-sm">{tActions('Drawer.Actions.moveUp')}</span>
                              </motion.div>
                           )}
                           {currentFolders.length > 0 && (
                              <SortableContext items={folderIds} strategy={staticListSortingStrategy}>
                                 {currentFolders.map((folder, index) => {
                                    const dropZoneId = `drop-zone-before-${folder.id}`;
                                    const showDropZone = index !== activeFolderIndex && index !== activeFolderIndex + 1;

                                    return (
                                       <React.Fragment key={folder.id}>
                                          {showDropZone && (
                                             <FolderDropZone
                                                id={dropZoneId}
                                                activeId={activeDragId}
                                                overId={overDragId}
                                                data={{
                                                   type: 'drawer-drop-zone',
                                                   targetId: folder.id,
                                                   position: 'before',
                                                }}
                                             />
                                          )}
                                          <DrawerFolderEntry
                                             key={folder.id}
                                             folder={folder}
                                             parentFolderId={currentFolderId}
                                             isOver={!!activeDragId && overDragId === folder.id && activeDragId !== folder.id}
                                             onNavigate={navigateToFolder}
                                             onRename={() => setActiveAction({ id: cuid(), type: 'rename-folder', target: folder })}
                                             onDelete={() => setActiveAction({ id: cuid(), type: 'delete-folder', target: folder })}
                                             onMove={() => setActiveAction({ id: cuid(), type: 'move-folder', target: folder })}
                                          />
                                       </React.Fragment>
                                    )
                                 })}
                                 {activeFolderIndex !== currentFolders.length - 1 && (
                                    <FolderDropZone
                                       id={`drop-zone-after-last`}
                                       activeId={activeDragId}
                                       overId={overDragId}
                                       data={{ type: 'drawer-drop-zone', targetId: 'last', position: 'after' }}
                                    />
                                 )}
                              </SortableContext>
                           )}
                           <motion.div layout transition={{ duration: 0.1 }} className="bg-card mt-1 border-2 border-dashed border-border rounded">
                              <Button variant="ghost" className="w-full justify-start cursor-pointer" onClick={handleAddFolder}>
                                 <Plus className="mr-2 h-4 w-4" />
                                 {t('Drawer.addFolder')}
                              </Button>
                           </motion.div>
                        </motion.div>

                        <motion.div data-tour="drawer-items" layout transition={{ duration: 0.1 }} className="flex-1 px-3 py-3 flex flex-col">
                           <div
                              ref={setNodeRef}
                              className={cn(
                                 "w-full grow min-h-full rounded-md border-2 border-dashed border-transparent transition-all duration-200 ease-in-out p-2",
                                 isDragHovering && "border-primary bg-primary/10"
                              )}
                           >
                              {currentItems.length > 0 ? (
                                 <div className="flex flex-col gap-2">
                                    <SortableContext items={currentItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
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
                                    </SortableContext>
                                 </div>
                              ) : (
                                 <motion.div layout transition={{ duration: 0.1 }} className="text-center py-8 h-full flex flex-col justify-center items-center">
                                    <Inbox className="mx-auto h-16 w-16 text-muted-foreground" />
                                    <p className="text-lg text-muted-foreground mt-2">{t('Drawer.emptyFolder')}</p>
                                 </motion.div>
                              )}
                           </div>
                        </motion.div>
                     </div>

                     <div className="flex flex-col shrink-0 p-2 mt-auto gap-2 bg-card border-t-2 border-border">
                        <form ref={formRef} className="hidden">
                           <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileSelected}
                              accept=".cotm,application/json"
                           />
                        </form>
                        <Button
                           data-tour="drawer-import"
                           variant="default"
                           className="w-full cursor-pointer"
                           onClick={() => fileInputRef.current?.click()}
                        >
                           <Download className="mr-2 h-4 w-4" />
                           {tActions('Drawer.Actions.import')}
                        </Button>
                        <Button
                           data-tour="drawer-export"
                           variant="default"
                           className="w-full cursor-pointer"
                           onClick={handleExportDrawer}
                        >
                           <Upload className="mr-2 h-4 w-4" />
                           {tActions('Drawer.Actions.exportFull')}
                        </Button>
                     </div>
               </motion.div>


               {activeAction && <div className="absolute inset-0 bg-black/40" />}

               <AnimatePresence>
                  {activeAction && (
                     <motion.div
                        key={activeAction.id}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                        onAnimationComplete={activeAction ? handleAnimationComplete : undefined}
                        className="absolute inset-0 z-10 flex flex-col justify-end"
                     >
                        <div className="relative z-20">
                           <DrawerModificationWindow
                              ref={inputRef}
                              action={activeAction}
                              onClose={handleCloseModificationWindow}
                              onConfirm={handleConfirmAction}
                           />
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>

            <AnimatePresence>
               {isDragActive && (
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-20 flex items-center justify-center p-3 bg-card/80 backdrop-blur-sm"
                  >
                     <div className="flex flex-col items-center justify-center w-full h-full text-center p-12 border-4 border-dashed border-primary/30">
                        <Download className="mx-auto h-12 w-12 text-primary" />
                        <p className="mt-2 font-semibold text-foreground">
                           {t('Drawer.dropToImport')}
                        </p>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>

         </div>
      </motion.aside>
   );
};
