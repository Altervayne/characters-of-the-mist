// -- React Imports --
import React from 'react';
import { useTranslation } from 'react-i18next';

// -- DnD Component Imports --
import { Sortable, DragStaticWrapper } from '@/components/dnd';

// -- Basic UI Imports --
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Folder, MoreHorizontal, Pencil, Trash2, Move, GripVertical, Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { exportToFile, generateExportFilename } from '@/lib/utils/export-import';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Type Imports --
import type { Folder as FolderType } from '@/lib/types/drawer';



export function DrawerFolderEntry({ folder, parentFolderId, isOver, onNavigate, onRename, onDelete, onMove }: { folder: FolderType, parentFolderId: string | null, isOver: boolean, onNavigate: (id: string) => void, onRename: () => void, onDelete: () => void, onMove: () => void }) {
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
