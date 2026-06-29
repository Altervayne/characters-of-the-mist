// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AnimatePresence, motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// -- Component Imports --
import { ThemeManager } from '@/components/organisms/dialogs/ThemeManager';
import { ThemeEditor, ThemeEditorPlaceholder } from '@/components/organisms/dialogs/ThemeEditor';

// -- Utils Imports --
import { importFromFile } from '@/lib/utils/export-import';
import { useThemeImport } from '@/lib/theme/useThemeImport';

// -- Store Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { customThemeClass } from '@/lib/theme/themeTokens';

/*
 * The dedicated Themes window: a master list (select / duplicate-from-any / rename / delete) on the left and
 * a detail area on the right. The detail edits the ACTIVE theme when it's a custom one (per-token light/dark
 * + radius + live previews); a preset is immutable, so it shows a "duplicate to edit" hint instead.
 *
 * Like the rest of the app, it accepts a dropped .cotm theme file (imported as a new custom); a non-theme
 * file dropped here is rejected with a toast, since this window only deals in themes.
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

   const importTheme = useThemeImport();
   const onDrop = useCallback(async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      try {
         importTheme(await importFromFile(file));
      } catch (error) {
         console.error('Theme import failed:', error);
         toast.error(t('Notifications.general.importFailed'));
      }
   }, [importTheme, t]);

   // Drop-only: the dialog's own clicks and keyboard must keep working, so no click/keyboard activation.
   const { getRootProps, isDragActive } = useDropzone({
      onDrop,
      noClick: true,
      noKeyboard: true,
      accept: { 'application/json': ['.cotm', '.json'] },
   });

   return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         {/* `p-0 gap-0` drops the dialog's own padding so each band fills edge to edge - the dividers run
             the full width/height and the three surface shades read as distinct sections. The shades use
             chrome tokens whose brightness order holds in light AND dark (and adapts to a custom theme):
             header = card (raised/brightest), list = popover (middle), editor = background (recedes). */}
         <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 gap-0 sm:max-w-5xl">
            <div {...getRootProps()} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
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

               {/* Drop a theme file anywhere on the window to import it. */}
               <AnimatePresence>
                  {isDragActive && (
                     <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex items-center justify-center p-3 bg-card/80 backdrop-blur-sm"
                     >
                        <div className="flex h-full w-full flex-col items-center justify-center border-4 border-dashed border-primary/30 p-12 text-center">
                           <Download className="mx-auto h-12 w-12 text-primary" />
                           <p className="mt-2 font-semibold text-foreground">{t('SettingsDialog.themes.dropToImport')}</p>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>
         </DialogContent>
      </Dialog>
   );
}
