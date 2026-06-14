// -- React Imports --
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Folder, ArrowLeft, ArrowUpToLine } from 'lucide-react';

// -- Utils Imports --
import { buildBreadcrumb, findFolderMemoized, findParentFolderMemoized } from '@/lib/utils/drawer';

// -- Component Imports --
import { Breadcrumb } from '@/components/molecules/Breadcrumbs';

// -- Store and Hook Imports --
import { useDrawerStore } from '@/lib/stores/drawerStore';

// -- Type Imports --
import type { ActiveAction } from '@/hooks/drawer/useDrawerActionState';



export function DrawerMoveItemNavigator({ action, onConfirm, onClose }: { action: ActiveAction, onConfirm: (destinationId?: string) => void, onClose: () => void }) {
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
                  <div onClick={() => setCurrentNavFolderId(null)} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted cursor-pointer shrink-0" role="button" aria-label={t('Drawer.backToRoot')}>
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
