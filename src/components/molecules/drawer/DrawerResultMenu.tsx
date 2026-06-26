// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { CornerUpRight, MoreHorizontal, Move, Pencil, Trash2 } from 'lucide-react';

/*
 * The search-result action menu: Jump-to-folder + rename / move / delete. Every action is id-based, so
 * it works in every result state - even while the rich card is still a content-free skeleton. Shared by
 * the light List row and the rich Rich card (in the card's header-action slot).
 */

interface DrawerResultMenuProps {
   onJumpTo: () => void;
   onRename: () => void;
   onDelete: () => void;
   onMove: () => void;
   /** Extra classes for the trigger button (the row hides it until hover; the card keeps it visible). */
   triggerClassName?: string;
}

export function DrawerResultMenu({ onJumpTo, onRename, onDelete, onMove, triggerClassName }: DrawerResultMenuProps) {
   const { t } = useTranslation();

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={`h-6 w-6 shrink-0 cursor-pointer ${triggerClassName ?? ''}`}>
               <MoreHorizontal className="h-4 w-4" />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onClick={onJumpTo} className="cursor-pointer">
               <CornerUpRight className="mr-2 h-4 w-4" />
               <span>{t('Drawer.search.jumpTo')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename} className="cursor-pointer">
               <Pencil className="mr-2 h-4 w-4" />
               <span>{t('Drawer.Actions.rename')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMove} className="cursor-pointer">
               <Move className="mr-2 h-4 w-4" />
               <span>{t('Drawer.Actions.move')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="cursor-pointer bg-destructive text-destructive-foreground">
               <Trash2 className="mr-2 h-4 w-4 text-destructive-foreground" />
               <span>{t('Drawer.Actions.delete')}</span>
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
