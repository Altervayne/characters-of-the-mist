// -- React Imports --
import { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';

// -- Icon Imports --
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, ArrowLeftToLine, ArrowRightToLine, Trash2 } from 'lucide-react';

// -- Basic UI Imports --
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// -- Type Imports --
import type { TableContextRequest } from '@/components/organisms/note/live/tableWidget';

/*
 * The live table's RIGHT-CLICK context menu (theme tokens). The table widget is imperative CM6 DOM, so it
 * can't host a Radix menu directly; instead a cell right-click hands this component a request - the screen
 * point + a bag of actions pre-bound to that cell (row/col). We render a controlled dropdown anchored to a
 * zero-size element at the cursor, so the menu appears exactly where the user clicked. Every action just
 * calls the widget's pre-bound callback (which rebuilds the markdown + dispatches); no buffer logic lives here.
 */

/** The imperative handle NoteView calls to open the menu (wired into the CM6 table controller). */
export interface NoteTableContextMenuHandle {
   open: (request: TableContextRequest) => void;
}

export function NoteTableContextMenu({ handleRef }: { handleRef: Ref<NoteTableContextMenuHandle> }) {
   const { t } = useTranslation();
   const [request, setRequest] = useState<TableContextRequest | null>(null);
   const open = !!request;

   useImperativeHandle(handleRef, () => ({ open: (req) => setRequest(req) }), []);

   const run = (action: () => void) => {
      setRequest(null);
      action();
   };

   const actions = request?.actions;

   return (
      <DropdownMenu open={open} onOpenChange={(next) => { if (!next) setRequest(null); }}>
         {/* A zero-size anchor pinned at the click point; the menu opens from here. */}
         <DropdownMenuTrigger asChild>
            <span
               aria-hidden
               style={{ position: 'fixed', left: request?.x ?? 0, top: request?.y ?? 0, width: 0, height: 0 }}
            />
         </DropdownMenuTrigger>
         {actions && (
            <DropdownMenuContent align="start" sideOffset={2} className="min-w-[11rem]">
               <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => run(actions.insertRowAbove)}>
                     <ArrowUpToLine /> {t('NoteView.tableMenu.insertRowAbove')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => run(actions.insertRowBelow)}>
                     <ArrowDownToLine /> {t('NoteView.tableMenu.insertRowBelow')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => run(actions.insertColumnLeft)}>
                     <ArrowLeftToLine /> {t('NoteView.tableMenu.insertColumnLeft')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => run(actions.insertColumnRight)}>
                     <ArrowRightToLine /> {t('NoteView.tableMenu.insertColumnRight')}
                  </DropdownMenuItem>
               </DropdownMenuGroup>
               <DropdownMenuSeparator />
               <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => run(() => actions.alignColumn('left'))}>
                     <AlignLeft /> {t('NoteView.tableMenu.alignLeft')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => run(() => actions.alignColumn('center'))}>
                     <AlignCenter /> {t('NoteView.tableMenu.alignCenter')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => run(() => actions.alignColumn('right'))}>
                     <AlignRight /> {t('NoteView.tableMenu.alignRight')}
                  </DropdownMenuItem>
               </DropdownMenuGroup>
               <DropdownMenuSeparator />
               <DropdownMenuGroup>
                  <DropdownMenuItem
                     variant="destructive"
                     disabled={!actions.canDeleteRow}
                     onSelect={() => run(actions.deleteRow)}
                  >
                     <Trash2 /> {t('NoteView.tableMenu.deleteRow')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                     variant="destructive"
                     disabled={!actions.canDeleteColumn}
                     onSelect={() => run(actions.deleteColumn)}
                  >
                     <Trash2 /> {t('NoteView.tableMenu.deleteColumn')}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => run(actions.deleteTable)}>
                     <Trash2 /> {t('NoteView.tableMenu.deleteTable')}
                  </DropdownMenuItem>
               </DropdownMenuGroup>
            </DropdownMenuContent>
         )}
      </DropdownMenu>
   );
}
