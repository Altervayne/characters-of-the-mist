// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/*
 * The close-confirm dialog for a tab with unsaved changes. Closing a tab is
 * destructive (it deletes the working record), so a dirty tab asks first. There is
 * no in-dialog save: the copy points the user at the normal Save / Save As, and the
 * only action here is to discard. A clean tab never opens this; its X closes silently.
 */

interface CloseTabDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
   /** The character's display name, woven into the warning. */
   characterName: string;
   /** Closes the tab and discards the unsaved changes. */
   onConfirm: () => void;
}

/**
 * Renders the unsaved-changes close-confirm dialog. Cancel keeps the tab open;
 * "Close without saving" discards via {@link CloseTabDialogProps.onConfirm}.
 *
 * @param props.isOpen - Whether the dialog is open.
 * @param props.onOpenChange - Open-state setter (Cancel / dismiss closes it).
 * @param props.characterName - The character's name, shown in the warning.
 * @param props.onConfirm - Discards and closes the tab.
 */
export function CloseTabDialog({ isOpen, onOpenChange, characterName, onConfirm }: CloseTabDialogProps) {
   const { t } = useTranslation();

   return (
      <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
         <AlertDialogContent>
            <AlertDialogHeader>
               <AlertDialogTitle>{t('Tabs.closeTabDialog.title')}</AlertDialogTitle>
               <AlertDialogDescription>
                  {t('Tabs.closeTabDialog.description', { name: characterName })}
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
               <AlertDialogCancel className="cursor-pointer">{t('Tabs.closeTabDialog.cancel')}</AlertDialogCancel>
               <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  onClick={onConfirm}
               >
                  {t('Tabs.closeTabDialog.closeWithoutSaving')}
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
   );
}
