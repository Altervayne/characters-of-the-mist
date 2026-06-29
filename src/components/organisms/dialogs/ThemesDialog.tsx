// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Component Imports --
import { ThemeManager } from '@/components/organisms/dialogs/ThemeManager';
import { ThemeEditor, ThemeEditorPlaceholder } from '@/components/organisms/dialogs/ThemeEditor';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { customThemeClass } from '@/lib/theme/themeTokens';

/*
 * The dedicated Themes window: a master list (select / duplicate-from-any / rename / delete) on the left and
 * a detail area on the right. The detail edits the ACTIVE theme when it's a custom one (per-token light/dark
 * + radius + live previews); a preset is immutable, so it shows a "duplicate to edit" hint instead.
 */

interface ThemesDialogProps {
   isOpen: boolean;
   onOpenChange: (isOpen: boolean) => void;
}

export function ThemesDialog({ isOpen, onOpenChange }: ThemesDialogProps) {
   const { t } = useTranslation();
   const theme = useAppSettingsStore((state) => state.theme);
   const customThemes = useAppSettingsStore((state) => state.customThemes);

   const editingTheme = customThemes.find((custom) => theme === customThemeClass(custom.id));

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         {/* `p-0 gap-0` drops the dialog's own padding so each band fills edge to edge - the dividers run
             the full width/height and the three surface shades read as distinct sections. The shades use
             chrome tokens whose brightness order holds in light AND dark (and adapts to a custom theme):
             header = card (raised/brightest), list = popover (middle), editor = background (recedes). */}
         <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 gap-0 sm:max-w-5xl">
            <DialogHeader className="border-b border-border bg-card px-6 py-4">
               <DialogTitle>{t('SettingsDialog.themes.windowTitle')}</DialogTitle>
               <DialogDescription>{t('SettingsDialog.themes.windowDescription')}</DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1 overflow-hidden">
               {/* Master: the theme list (its own panel; it owns the customs scroll). */}
               <div className="flex w-56 shrink-0 flex-col border-r border-border bg-popover p-2">
                  <ThemeManager />
               </div>

               {/* Detail: the editor for the active custom theme, or a hint for an (immutable) preset. */}
               <div className="min-w-0 flex-1 overflow-y-auto bg-background p-4">
                  {editingTheme ? <ThemeEditor key={editingTheme.id} theme={editingTheme} /> : <ThemeEditorPlaceholder />}
               </div>
            </div>
         </DialogContent>
      </Dialog>
   );
}
