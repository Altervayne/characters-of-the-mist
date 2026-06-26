// -- React Imports --
import React from 'react';
import { useTranslation } from 'react-i18next';

// -- DnD Component Imports --
import { Sortable, DragStaticWrapper } from '@/components/dnd';

// -- Basic UI Imports --
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { MoreHorizontal, Pencil, Trash2, Move, GripVertical, Upload } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { getItemTypeIcon } from '@/lib/utils/drawer-icons';
import { getGameVisual } from '@/lib/constants/gameVisuals';
import { deriveExportHandle, exportToFile, generateExportFilename } from '@/lib/utils/export-import';
import { DRAG_TYPES } from '@/lib/constants/dragDrop';

// -- Component Imports --
import { ItemDateLabel } from '@/components/molecules/drawer/ItemDateLabel';

// -- Type Imports --
import type { ReactElement } from 'react';
import type { DrawerItem, GameSystem } from '@/lib/types/drawer';

/** The game glyph element (resolved in this module helper, not in render); neutral items have none. */
function gameGlyph(game: GameSystem): ReactElement | null {
   if (game === 'NEUTRAL') return null;
   const Icon = getGameVisual(game).Icon;
   return <Icon className="h-4 w-4 shrink-0" />;
}

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
               <div
                  className={cn(
                     "group flex items-center justify-between gap-2 py-1 pl-1 pr-2 rounded hover:bg-muted data-[state=open]:bg-muted",
                     { "border-2 border-border bg-muted/50": isPreview }
                  )}
               >
                  <div className="flex h-8 min-w-0 items-center gap-2">
                     <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground cursor-grab" {...dragAttributes} {...dragListeners} />
                     {getItemTypeIcon(item.type)}
                     <span className="truncate font-medium text-sm">{item.name}</span>
                     {/* Meta line: game glyph + the date label, muted, after the name. */}
                     <span className="ml-1 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {gameGlyph(item.game)}
                        <ItemDateLabel type={item.type} createdAt={item.createdAt} updatedAt={item.updatedAt} />
                     </span>
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
            </DragStaticWrapper>
         )}
      </Sortable>
   );
}
