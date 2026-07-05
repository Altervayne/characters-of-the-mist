// -- React Imports --
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { MoreVertical, Save, SaveAll } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Basic UI Imports --
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// -- Store and Hook Imports --
import { useBoardItemSaveBack } from '@/hooks/board/useBoardItemSaveBack';

/*
 * The overflow (kebab) menu for a board card/tracker COPY's toolbar slot: Save (write the edited copy back
 * to its linked drawer item) and Save As (mint a fresh drawer item + adopt it). A source-bearing copy has a
 * live drawer twin, so it offers both and the trigger wears the bar's active tint; a source-less copy
 * (sheet-born / mention-minted) has nothing to write back to, so it offers Save As only. Anchored via the
 * shared Radix popover (portals to body, tracks the trigger's live rect at any pan/zoom), modal so a
 * dismissing outside-click is consumed here and never deselects the host mid-close.
 */

interface BoardItemSaveMenuProps {
   content: { sourceDrawerItemId?: string; data: unknown };
   /** Adopts a minted drawer id onto this copy's source link via a direct (non-undoable) write. */
   onAdoptSource: (sourceDrawerItemId: string) => void;
}

export function BoardItemSaveMenu({ content, onAdoptSource }: BoardItemSaveMenuProps) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);
   const { saveItem, saveItemAs } = useBoardItemSaveBack({ content, onAdoptSource });

   const hasSource = content.sourceDrawerItemId !== undefined;

   const run = (action: () => void | Promise<void>) => {
      setOpen(false);
      void action();
   };

   return (
      <Popover open={open} modal onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <button
               type="button"
               title={t('BoardView.itemActions')}
               aria-label={t('BoardView.itemActions')}
               onPointerDown={(event) => event.stopPropagation()}
               className={cn(
                  'flex cursor-pointer items-center justify-center rounded p-1',
                  hasSource ? 'bg-muted text-primary' : 'text-popover-foreground hover:bg-muted',
               )}
            >
               <MoreVertical className="h-4 w-4" />
            </button>
         </PopoverTrigger>
         <PopoverContent
            align="center"
            sideOffset={6}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex w-auto flex-col gap-0.5 rounded-lg border border-border bg-popover/90 p-1 shadow-md backdrop-blur-sm"
         >
            {hasSource && (
               <MenuRow icon={<Save className="h-4 w-4" />} label={t('BoardView.saveItemToDrawer')} onClick={() => run(saveItem)} />
            )}
            <MenuRow icon={<SaveAll className="h-4 w-4" />} label={t('BoardView.saveItemToDrawerAs')} onClick={() => run(saveItemAs)} />
         </PopoverContent>
      </Popover>
   );
}

/** A labelled action row in the overflow menu (icon + text), on the bar's token vocabulary. */
function MenuRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
   return (
      <button
         type="button"
         onClick={onClick}
         className="flex items-center gap-2 rounded p-1 text-left text-popover-foreground hover:bg-muted"
      >
         {icon}
         <span className="whitespace-nowrap text-sm">{label}</span>
      </button>
   );
}
