// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Component Imports --
import { ThemeManager } from '@/components/organisms/dialogs/ThemeManager';

/*
 * The dedicated Themes window: hosts the full theme manager (select / duplicate-from-any / rename / delete)
 * that used to clutter Settings. Sized with room to grow - the per-custom editor (themes-3b) slots into
 * this window beside the list, so Settings stays a simple selector + this button.
 */

interface ThemesDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}

export function ThemesDialog({ isOpen, onOpenChange }: ThemesDialogProps) {
   const { t } = useTranslation();

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
               <DialogTitle>{t('SettingsDialog.themes.windowTitle')}</DialogTitle>
               <DialogDescription>{t('SettingsDialog.themes.windowDescription')}</DialogDescription>
            </DialogHeader>

            <ThemeManager />
         </DialogContent>
      </Dialog>
   );
}
