// -- React Imports --
import React from 'react';
import { useTranslation } from 'react-i18next';

// -- DnD Component Imports --
import { Sortable, DragStaticWrapper } from '@/components/dnd';

// -- Basic UI Imports --
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { MoreHorizontal, Pencil, Trash2, Move, Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { deriveExportHandle, exportToFile, generateExportFilename } from '@/lib/utils/export-import';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Component Imports --
import { DrawerListRow, DrawerListRowFrame } from '@/components/molecules/drawer/DrawerListRow';

// -- Type Imports --
import type { DrawerItem } from '@/lib/types/drawer';

export function DrawerCompactItemEntry({ item, parentFolderId, onRename, onDelete, onMove, isPreview = false }: { item: DrawerItem & { createdAt?: number; updatedAt?: number }, parentFolderId?: string | null, onRename?: () => void, onDelete?: () => void, onMove?: () => void, isPreview?: boolean }) {
   const { t } = useTranslation();

   const handleExport = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const { content, type, game, name } = item;

      const handle = deriveExportHandle(content, name);

      const fileName = generateExportFilename(game, type, handle);
      try {
         await exportToFile(content, type, game, fileName);
      } catch (error) {
         console.error('Drawer item export failed:', error);
      }
   };

   return (
      <Sortable
         id={item.id}
         data={{ type: DRAG_TYPES.DRAWER_ITEM, item, parentFolderId: parentFolderId ?? null, isDrawer: true }}
         disabled={isPreview}
      >
         {({ dragAttributes, dragListeners, isBeingDragged }) => (
            <DragStaticWrapper isBeingDragged={isBeingDragged}>
               <DrawerListRowFrame
                  className={cn(isPreview && 'border-2 border-border bg-muted/50')}
                  menu={!isPreview &&
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()} className="cursor-pointer">
                           <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100">
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
               >
                  {/* The whole row is the drag handle; the menu overlays it on hover (a sibling, so a menu
                      click never starts a drag), mirroring the rich result card. */}
                  <div {...dragAttributes} {...dragListeners} className="cursor-grab">
                     <DrawerListRow
                        type={item.type}
                        name={item.name}
                        game={item.game}
                        createdAt={item.createdAt}
                        updatedAt={item.updatedAt}
                     />
                  </div>
               </DrawerListRowFrame>
            </DragStaticWrapper>
         )}
      </Sortable>
   );
}
