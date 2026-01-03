// -- React Imports --
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AnimatePresence, motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import cuid from 'cuid';
import toast from 'react-hot-toast';

// -- DnD Component Imports --
import { Sortable, DragStaticWrapper, DragLayoutWrapper } from '@/components/dnd';

// -- Basic UI Imports --
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';

// -- Icon Imports --
import { Folder, Plus, ArrowLeft, Inbox, MoreHorizontal, Pencil, Trash2, X, ArrowUpToLine, Move, GripVertical, Download, Upload, LayoutGrid, Rows, FileText, FileUser, IdCard, RectangleEllipsis, CreditCard, FileHeart, WalletCards, PanelRightClose } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { buildBreadcrumb, buildFolderPathIds, getParentFromPath, findFolderMemoized, findParentFolderMemoized } from '@/lib/utils/drawer';
import { staticListSortingStrategy } from '@/lib/utils/dnd';
import { exportDrawer, exportToFile, generateExportFilename, importFromFile } from '@/lib/utils/export-import';
import { DRAG_TYPES } from '@/lib/constants/drag-drop';

// -- Component Imports --
import { DrawerItemPreview } from '../molecules/drawer-item-preview';
import { Breadcrumb } from '../molecules/breadcrumbs';
import FolderDropZone from '../molecules/folder-drop-zone';
import { DrawerUndoRedoControls } from '../molecules/drawer-undo-redo-controls';

// -- Store and Hook Imports --
import { useDrawerStore, useDrawerActions } from '@/lib/stores/drawerStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { Variants } from 'framer-motion';
import type { PendingDrawerItem } from '@/lib/stores/drawerStore';
import type { Folder as FolderType, DrawerItem, DrawerItemContent, Drawer as DrawerType, GeneralItemType } from '@/lib/types/drawer';
import type { LegendsHeroDetails, LegendsThemeDetails, Card as CardData } from '@/lib/types/character';



type ActionType = 'add-folder' | 'rename-folder' | 'delete-folder' | 'add-item' | 'rename-item' | 'delete-item' | 'move-item' | 'move-folder';

interface ActiveAction {
   id: string;
   type: ActionType;
   target?: FolderType | DrawerItem | PendingDrawerItem;
   parentId?: string | null;
}

interface ModificationWindowProps {
   action: ActiveAction;
   onClose: () => void;
   onConfirm: (value?: string) => void;
};



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



function FolderEntry({ folder, parentFolderId, isOver, onNavigate, onRename, onDelete, onMove }: { folder: FolderType, parentFolderId: string | null, isOver: boolean, onNavigate: (id: string) => void, onRename: () => void, onDelete: () => void, onMove: () => void }) {
   const { t } = useTranslation();

   const handleExport = (e: React.MouseEvent) => {
      e.stopPropagation();
      const fileName = generateExportFilename('NEUTRAL', 'FOLDER', folder.name);
      exportToFile(folder, 'FOLDER', 'NEUTRAL', fileName);
   };

   return (
      <Sortable
         id={folder.id}
         data={{
            type: DRAG_TYPES.DRAWER_FOLDER,
            item: folder,
            parentFolderId,
            isDrawer: true
         }}
      >
         {({ dragAttributes, dragListeners, isBeingDragged }) => (
            <div onClick={() => onNavigate(folder.id)}>
               <DragStaticWrapper isBeingDragged={isBeingDragged}>
                  <div
                     className={cn(
                        "group flex items-center justify-between gap-2 py-1 pl-1 pr-2 rounded hover:bg-muted data-[state=open]:bg-muted",
                        {
                           "bg-muted": isOver,
                        }
                     )}
                  >
                     <div
                        className="flex h-8 items-center gap-2 truncate"
                        onClick={() => onNavigate(folder.id)}
                     >
                        <GripVertical
                           className="h-5 w-5 shrink-0 text-muted-foreground cursor-grab"
                           {...dragAttributes}
                           {...dragListeners}
                        />
                        <Folder className="h-6 w-6 shrink-0 text-muted-foreground"/>
                        <span className="truncate hover:text-wrap font-medium text-sm">{folder.name}</span>
                     </div>

                     <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()} className="cursor-pointer">
                           <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.rename')}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); }} className="cursor-pointer">
                              <Move className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.move')}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
                              <Upload className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.export')}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive cursor-pointer">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.delete')}</span>
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
               </DragStaticWrapper>
            </div>
         )}
      </Sortable>
   );
};

function ItemEntry({ item, parentFolderId, onRename, onDelete, onMove }: { item: DrawerItem, parentFolderId: string | null, onRename: () => void, onDelete: () => void, onMove: () => void }) {
   const { t } = useTranslation();

   const handleExport = (e: React.MouseEvent) => {
      e.stopPropagation();
      const { content, type, game, name } = item;

      let handle: string | undefined = name;
      if ('cardType' in content) {
         const cardContent = content as CardData;

         if (type === 'CHARACTER_THEME' || type === 'GROUP_THEME') {
            handle = (cardContent.details as LegendsThemeDetails).mainTag.name;
         } else if (type === 'CHARACTER_CARD') {
            handle = (cardContent.details as LegendsHeroDetails).characterName;
         }
      }

      const fileName = generateExportFilename(game, type, handle);
      exportToFile(content, type, game, fileName);
   };

   return (
      <Sortable
         id={item.id}
         data={{
            type: DRAG_TYPES.DRAWER_ITEM,
            item: item,
            parentFolderId,
            isDrawer: true
         }}
      >
         {({ dragAttributes, dragListeners, isBeingDragged }) => (
            <DragLayoutWrapper isBeingDragged={isBeingDragged}>
               <div className="relative group/item data-[state=open]:bg-muted">
                  <div {...dragAttributes} {...dragListeners} className="cursor-grab">
                     <DrawerItemPreview item={item} />
                  </div>
                  <div className="absolute top-1 right-1 z-10">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-pointer">
                              <MoreHorizontal className="h-4 w-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                           <DropdownMenuItem onClick={onRename} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.rename')}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={onMove} className="cursor-pointer">
                              <Move className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.move')}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={handleExport} className="cursor-pointer">
                              <Upload className="mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.export')}</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={onDelete} className="bg-destructive text-destructive-foreground cursor-pointer">
                              <Trash2 className="text-destructive-foreground mr-2 h-4 w-4" />
                              <span>{t('Drawer.Actions.delete')}</span>
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
               </div>
            </DragLayoutWrapper>
         )}
      </Sortable>
   );
};



const getItemTypeIcon = (type: GeneralItemType) => {
   switch (type) {
      case 'CHARACTER_CARD':
         return <FileUser className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'FULL_CHARACTER_SHEET':
         return <IdCard className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'CHARACTER_THEME':
         return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'GROUP_THEME':
         return <FileHeart className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'STATUS_TRACKER':
         return <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'STORY_TAG_TRACKER':
         return <RectangleEllipsis className="h-5 w-5 shrink-0 text-muted-foreground" />;
      case 'STORY_THEME_TRACKER':
         return <WalletCards className="h-5 w-5 shrink-0 text-muted-foreground" />;
      default:
         return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />;
   }
};

export function CompactItemEntry({ item, parentFolderId, onRename, onDelete, onMove, isPreview = false }: { item: DrawerItem, parentFolderId?: string | null, onRename?: () => void, onDelete?: () => void, onMove?: () => void, isPreview?: boolean }) {
   const { t } = useTranslation();

   const handleExport = (e: React.MouseEvent) => {
      e.stopPropagation();
      const { content, type, game, name } = item;

      let handle: string | undefined = name;
      if ('cardType' in content) {
         const cardContent = content as CardData;

         if (type === 'CHARACTER_THEME' || type === 'GROUP_THEME') {
            handle = (cardContent.details as LegendsThemeDetails).mainTag.name;
         } else if (type === 'CHARACTER_CARD') {
            handle = (cardContent.details as LegendsHeroDetails).characterName;
         }
      }

      const fileName = generateExportFilename(game, type, handle);
      exportToFile(content, type, game, fileName);
   };

   return (
      <Sortable
         id={item.id}
         data={{ type: DRAG_TYPES.DRAWER_ITEM, item, parentFolderId: parentFolderId ?? null, isDrawer: true }}
         disabled={isPreview}
      >
         {({ dragAttributes, dragListeners, isBeingDragged }) => (
            <DragLayoutWrapper isBeingDragged={isBeingDragged}>
               <div
                  className={cn(
                     "group flex items-center justify-between gap-2 py-1 pl-1 pr-2 rounded hover:bg-muted data-[state=open]:bg-muted",
                     { "border-2 border-border bg-muted/50": isPreview }
                  )}
               >
                  <div className="flex h-8 items-center gap-2 truncate">
                     <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground cursor-grab" {...dragAttributes} {...dragListeners} />
                     {getItemTypeIcon(item.type)}
                     <span className="truncate hover:text-wrap font-medium text-sm">{item.name}</span>
                  </div>
                  {!isPreview &&
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()} className="cursor-pointer">
                           <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                           <DropdownMenuItem onClick={onRename} className="cursor-pointer"><Pencil className="mr-2 h-4 w-4" /><span>{t('Drawer.Actions.rename')}</span></DropdownMenuItem>
                           <DropdownMenuItem onClick={onMove} className="cursor-pointer"><Move className="mr-2 h-4 w-4" /><span>{t('Drawer.Actions.move')}</span></DropdownMenuItem>
                           <DropdownMenuItem onClick={handleExport} className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /><span>{t('Drawer.Actions.export')}</span></DropdownMenuItem>
                           <DropdownMenuItem onClick={onDelete} className="text-destructive cursor-pointer"><Trash2 className="mr-2 h-4 w-4" /><span>{t('Drawer.Actions.delete')}</span></DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  }
               </div>
            </DragLayoutWrapper>
         )}
      </Sortable>
   );
}




function MoveItemNavigator({ action, onConfirm, onClose }: { action: ActiveAction, onConfirm: (destinationId?: string) => void, onClose: () => void }) {
   const { t } = useTranslation();
   const { folders: allFolders } = useDrawerStore((state) => state.drawer);
   const [currentNavFolderId, setCurrentNavFolderId] = useState<string | null>(null);

   const itemToMove = (action.target && 'id' in action.target) ? action.target : null;

   const currentView = useMemo(() => {
      if (!currentNavFolderId) return { folders: allFolders, parent: null };
      const folder = findFolderMemoized(allFolders, currentNavFolderId);
      return { folders: folder?.folders ?? [], parent: findParentFolderMemoized(allFolders, currentNavFolderId) };
   }, [currentNavFolderId, allFolders]);

   const breadcrumbPath = useMemo(() => buildBreadcrumb(allFolders, currentNavFolderId), [allFolders, currentNavFolderId]);

   const parentOfItemToMove = useMemo(() => {
      return itemToMove ? findParentFolderMemoized(allFolders, itemToMove.id) : null;
   }, [allFolders, itemToMove]);

   return (
      <div className="flex flex-col h-150">
         <header className="p-4 border-y">
            <div className="flex justify-between items-center mb-2">
               <div>
                  <h3 className="font-semibold">{(action.type == 'move-folder') && t('Drawer.Actions.moveFolderTitle')}{(action.type == 'move-item') && t('Drawer.Actions.moveItemTitle')}</h3>
                  <p className="text-sm text-muted-foreground">{`${t('Drawer.Actions.moveVerb')}:  ${itemToMove?.name ?? t('Drawer.movingUnknown')}`}</p>
               </div>
               {currentNavFolderId && (
                  <div onClick={() => setCurrentNavFolderId(null)} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted cursor-pointer shrink-0" role="button" aria-label="Back to root">
                        <ArrowUpToLine className="h-5 w-5" />
                  </div>
               )}
            </div>

            <div className="mt-2 flex items-center gap-2">
               <Breadcrumb path={breadcrumbPath} onNavigate={setCurrentNavFolderId} />
            </div>
         </header>

         <div className="grow overflow-y-auto p-2">
            
            {currentNavFolderId && (
               <div onClick={() => setCurrentNavFolderId(currentView.parent?.id ?? null)} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                  <ArrowLeft className="h-6 w-6" /> <span>{t('Drawer.Actions.moveUp')}</span>
               </div>
            )}
            {currentView.folders.map(folder => {
               if (action.type === 'move-folder' && folder.id === itemToMove?.id) {
                  return null;
               }
               return (
                  <div 
                     key={folder.id} 
                     onClick={() => setCurrentNavFolderId(folder.id)}
                     className="flex px-2 h-10 items-center gap-2 truncate rounded hover:bg-muted"
                  >
                     <Folder className="h-6 w-6 shrink-0 text-muted-foreground"/>
                     <span className="truncate font-medium text-sm">{folder.name}</span>
                  </div>
               );
            })}
         </div>

         <footer className="p-4 border-t flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} className="cursor-pointer">{t('Drawer.Actions.cancel')}</Button>
            <Button 
               onClick={() => onConfirm(currentNavFolderId ?? undefined)}
               disabled={(parentOfItemToMove?.id ?? null) === currentNavFolderId}
            >
               {t('Drawer.Actions.moveHere')}
            </Button>
         </footer>
      </div>
   );
}

const ModificationWindow = React.forwardRef<HTMLInputElement, ModificationWindowProps>(
   function ModificationWindow({ action, onClose, onConfirm }, ref) {
      const { t } = useTranslation();

      const handleSubmit = (e: React.FormEvent) => {
         e.preventDefault();
         onConfirm(inputValue);
      };


      let initialName = (action.target && 'defaultName' in action.target) ? action.target.defaultName : action.target?.name ?? '';
      if (!initialName && action.type === 'add-item' && action.target && 'type' in action.target) {
         const itemType = (action.target as PendingDrawerItem).type;
         switch (itemType) {
            case 'CHARACTER_CARD':        initialName = t('Drawer.Actions.defaultNames.characterCard'); break;
            case 'FULL_CHARACTER_SHEET':  initialName = t('Drawer.Actions.defaultNames.fullSheet'); break;
            case 'CHARACTER_THEME':       initialName = t('Drawer.Actions.defaultNames.characterTheme'); break;
            case 'GROUP_THEME':           initialName = t('Drawer.Actions.defaultNames.groupTheme'); break;
            case 'STATUS_TRACKER':        initialName = t('Drawer.Actions.defaultNames.statusTracker'); break;
            case 'STORY_TAG_TRACKER':     initialName = t('Drawer.Actions.defaultNames.storyTagTracker'); break;
            default:                      initialName = t('Drawer.Actions.defaultNames.defaultItem'); break;
         }
      }

      const [inputValue, setInputValue] = useState(initialName);

      const isFolder = action.type.includes('folder');
      let title = '';
      let confirmText = '';
      let isDelete = false;

      switch (action.type) {
         case 'add-folder':
            title = t('Drawer.Actions.addFolderTitle');
            confirmText = t('Drawer.Actions.createFolder');
            break;

         case 'add-item':
            title = t('Drawer.Actions.nameItemTitle');
            confirmText = t('Drawer.Actions.saveChanges');
            break;

         case 'rename-folder':
            title = t('Drawer.Actions.renameFolderTitle');
            confirmText = t('Drawer.Actions.saveChanges');
            break;

         case 'rename-item':
            title = t('Drawer.Actions.renameItemTitle');
            confirmText = t('Drawer.Actions.saveChanges');
            break;

         case 'delete-folder':
            title = t('Drawer.Actions.deleteFolderTitle');
            confirmText = t('Drawer.Actions.confirmDelete');
            isDelete = true;
            break;

         case 'delete-item':
            title = t('Drawer.Actions.deleteItemTitle');
            confirmText = t('Drawer.Actions.confirmDelete');
            isDelete = true;
            break;
      }



      if (action.type === 'move-item' || action.type === 'move-folder') {
         return (
            <div className="bg-background">
               <MoveItemNavigator 
                  action={action} 
                  onConfirm={(destinationId) => onConfirm(destinationId)} 
                  onClose={onClose} 
               />
            </div>
         );
      }


      
      return (
         <div className="bg-background border-t p-4">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-semibold">{title}</h3>
               <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={onClose}>
                  <X className="h-4 w-4" />
               </Button>
            </div>
            {!isDelete ? (
               <form onSubmit={handleSubmit}>
                  <Label htmlFor="item-name" className="sr-only">Name</Label>
                  <Input ref={ref} id="item-name" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
               </form>
            ) : (
               <p className="text-sm text-muted-foreground">{t(isFolder ? 'Drawer.Actions.deleteFolderMessage' : 'Drawer.Actions.deleteItemMessage', { name: (action.target && 'name' in action.target) ? action.target.name : '' })}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
               <Button variant="ghost" onClick={onClose} className="cursor-pointer">{t('Drawer.Actions.cancel')}</Button>
               <Button variant={isDelete ? 'destructive' : 'default'} onClick={() => onConfirm(inputValue)} className="cursor-pointer">
                  {confirmText}
               </Button>
            </div>
         </div>
      );
   }
)



export function Drawer({ isDragHovering, activeDragId, overDragId }: { isDragHovering : boolean, activeDragId: string | null, overDragId: string | null; }) {
   const { t: t } = useTranslation();
   const { t: tActions } = useTranslation()
   const { t: tNotifications } = useTranslation();

   const folders = useDrawerStore((state) => state.drawer.folders);
   const rootItems = useDrawerStore((state) => state.drawer.rootItems);
   const pendingItem = useDrawerStore((state) => state.pendingItem);
   
   const {  importFullDrawer,
            addFolder, addImportedFolder, renameFolder, deleteFolder, moveFolder,
            addItem, addImportedItem, renameItem, deleteItem, moveItem,
            clearPendingItemDrop } = useDrawerActions();

   const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
   const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);

   // Cache folder path as chain of IDs: ['rootId', 'childId', 'currentId']
   // Provides O(1) access to parent folder ID
   const currentFolderPath = useMemo(() => buildFolderPathIds(folders, currentFolderId), [folders, currentFolderId]);

   useEffect(() => {
      if (pendingItem) {
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setActiveAction({
            id: cuid(),
            type: 'add-item',
            target: pendingItem,
         });
      }
    }, [pendingItem]);

   const handleAnimationComplete = () => {
      if (activeAction) {
         setTimeout(() => {
            inputRef.current?.focus();
         }, 0);
      }
   };



   const isCompactDrawer = useAppSettingsStore((state) => state.isCompactDrawer);
   const { toggleCompactDrawer } = useAppSettingsActions();
   const { setDrawerOpen } = useAppGeneralStateActions();



   const { currentItems, currentFolders, parentFolderId } = useMemo(() => {
      if (!currentFolderId) {
         return { currentItems: rootItems, currentFolders: folders, parentFolderId: null };
      }
      const folder = findFolderMemoized(folders, currentFolderId);
      if (folder) {
         // O(1) parent lookup using cached path instead of O(n) tree traversal
         const parentId = getParentFromPath(currentFolderPath);
         return { currentItems: folder.items, currentFolders: folder.folders, parentFolderId: parentId };
      }
      return { currentItems: rootItems, currentFolders: folders, parentFolderId: null };
   }, [currentFolderId, folders, rootItems, currentFolderPath]);

   const breadcrumbPath = useMemo(() => buildBreadcrumb(folders, currentFolderId), [folders, currentFolderId]);

   const handleAddFolder = () => {
      setActiveAction({ id: cuid(), type: 'add-folder', parentId: currentFolderId });
   };

   const handleConfirmAction = (value?: string) => {
      if (!activeAction) return;
      const target = activeAction.target;


      switch (activeAction.type) {
         case 'add-folder':
            if (value) {
               addFolder(value, activeAction.parentId ?? undefined);
               toast.success(tNotifications('Notifications.drawer.folderCreated'));
            }   
            break;

         case 'rename-folder':
            if (target && 'items' in target && value) {
               renameFolder(target.id, value);
               toast.success(tNotifications('Notifications.drawer.folderRenamed'));
            }
            break;

         case 'delete-folder':
            if (target && 'items' in target) {
               deleteFolder(target.id);
               toast.success(tNotifications('Notifications.drawer.folderDeleted'));
            }
            break;

         case 'move-folder':
            if (target && 'items' in target) {
               moveFolder(target.id, value);
               toast.success(tNotifications('Notifications.drawer.folderMoved'));
            }   
            break;



         case 'rename-item':
            if (target && 'id' in target && 'content' in target && value) {
               renameItem(target.id, value);
               toast.success(tNotifications('Notifications.drawer.itemRenamed'));
            }
            break;

         case 'delete-item':
            if (target && 'id' in target && 'content' in target) {
               deleteItem(target.id);
               toast.success(tNotifications('Notifications.drawer.itemDeleted'));
            }
            break;

         case 'add-item':
            if (value && target && 'defaultName' in target) {
               const { game, type, content, parentFolderId } = target;
               addItem(value, game, type, content, parentFolderId);
               toast.success(tNotifications('Notifications.drawer.itemCreated'));
            }
            clearPendingItemDrop();
            break;

         case 'move-item':
            if (target && 'id' in target && 'content' in target) {
               moveItem(target.id, value);
               toast.success(tNotifications('Notifications.drawer.itemMoved'));
            }   
            break;
      }

      setActiveAction(null);
   };

   const handleCloseModificationWindow = () => {
      if (activeAction?.type === 'add-item') {
         clearPendingItemDrop();
      }
      setActiveAction(null);
   };

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



   const processFile = useCallback(async (file?: File) => {
      if (!file) return;

      try {
         const importedData = await importFromFile(file);

         switch (importedData.fileType) {
            case 'FULL_DRAWER':
               importFullDrawer(importedData.content as DrawerType);
               break;

            case 'FOLDER':
               addImportedFolder(importedData.content as FolderType, currentFolderId ?? undefined);
               break;
            
            default:
               addImportedItem(importedData.content as DrawerItemContent, importedData.fileType, importedData.game, currentFolderId ?? undefined);
               break;
         }

         toast.success(tNotifications('Notifications.drawer.importSuccess'));
         
      } catch (error) {
         toast.error(tNotifications('Notifications.general.importFailed'));
         console.error("Failed to import file:", error);
      }
   }, [currentFolderId, addImportedFolder, addImportedItem, importFullDrawer, tNotifications]);

   const onDrop = useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
         processFile(acceptedFiles[0]);
      }
   }, [processFile]);

   const { getRootProps, isDragActive } = useDropzone({
      onDrop,
      noClick: true,
      noKeyboard: true,
      accept: {
         'application/json': ['.cotm', '.json'],
      },
   });



   const inputRef = useRef<HTMLInputElement>(null);
   const formRef = useRef<HTMLFormElement>(null);

   const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      processFile(file);
      formRef.current?.reset();
   };

   const handleExportDrawer = () => {
      const drawerState = useDrawerStore.getState().drawer;
      exportDrawer(drawerState);
      toast.success(tNotifications('Notifications.drawer.exported'));
   };



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
                              <div onClick={() => setCurrentFolderId(null)} className="rounded p-1 hover:bg-muted cursor-pointer shrink-0" role="button" aria-label="Back to root">
                                 <ArrowUpToLine className="h-4 w-4" />
                              </div>
                              <Breadcrumb path={breadcrumbPath} onNavigate={setCurrentFolderId} />
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
                                 onClick={() => setCurrentFolderId(parentFolderId)}
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
                                          <FolderEntry
                                             key={folder.id}
                                             folder={folder}
                                             parentFolderId={currentFolderId}
                                             isOver={!!activeDragId && overDragId === folder.id && activeDragId !== folder.id}
                                             onNavigate={setCurrentFolderId}
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
                                             ? <CompactItemEntry key={item.id} {...commonProps} />
                                             : <ItemEntry key={item.id} {...commonProps} />;
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
                              ref={inputRef}
                              onChange={handleFileSelected}
                              accept=".cotm,application/json"
                           />
                        </form>
                        <Button
                           data-tour="drawer-import"
                           variant="default"
                           className="w-full cursor-pointer"
                           onClick={() => inputRef.current?.click()}
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
                           <ModificationWindow
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
