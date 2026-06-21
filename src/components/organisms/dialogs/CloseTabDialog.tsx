// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/*
 * The close-confirm dialog for a tab. Closing a tab is destructive (it deletes the
 * working record), so it asks first. There is no in-dialog save; the only action is to
 * discard.
 *
 * Two flavours by `variant`:
 * - 'character' (default): a DIRTY character tab confirms before discarding unsaved
 *   changes (a clean one closes silently and never opens this).
 * - 'board': a board has no drawer save yet, so closing ALWAYS discards it for good -
 *   the copy says so plainly.
 */

interface CloseTabDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
   /** The tab's display name, woven into the warning. */
   name: string;
   /** Which copy to show. Defaults to the character (unsaved-changes) flavour. */
   variant?: 'character' | 'board';
   /** Closes the tab and discards it. */
   onConfirm: () => void;
}

/**
 * Renders the close-confirm dialog. Cancel keeps the tab open; the action discards via
 * {@link CloseTabDialogProps.onConfirm}.
 *
 * @param props - See {@link CloseTabDialogProps}.
 */
export function CloseTabDialog({ isOpen, onOpenChange, name, variant = 'character', onConfirm }: CloseTabDialogProps) {
   const { t } = useTranslation();
   const copy = variant === 'board' ? 'Tabs.closeBoardDialog' : 'Tabs.closeTabDialog';
   const confirmKey = variant === 'board' ? `${copy}.confirm` : `${copy}.closeWithoutSaving`;

   return (
      <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>{t(`${copy}.title`)}</AlertDialogTitle>
               <AlertDialogDescription>{t(`${copy}.description`, { name })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel className="cursor-pointer">{t('Tabs.closeTabDialog.cancel')}</AlertDialogCancel>
               <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  onClick={onConfirm}
               >
                  {t(confirmKey)}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
