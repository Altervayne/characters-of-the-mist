// -- React Imports --
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Download, LifeBuoy } from 'lucide-react';

// -- Hook Imports --
import { useFileDrop } from '@/hooks/useFileDrop';

// -- Basic UI Imports --
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// -- Component Imports --
import { ThemeManager } from '@/components/organisms/dialogs/ThemeManager';
import { ThemeEditor, ThemeEditorPlaceholder } from '@/components/organisms/dialogs/ThemeEditor';

// -- Utils Imports --
import { importFromFile } from '@/lib/utils/export-import';
import { useThemeImport } from '@/lib/theme/useThemeImport';
import { ThemeSwitchGuardProvider } from '@/components/organisms/dialogs/themeSwitchGuard';

// -- Store Imports --
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { customThemeClass, customThemeIdFromClass, themeEditorFieldsEqual } from '@/lib/theme/themeTokens';

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
   const themeDraft = useAppSettingsStore((state) => state.themeDraft);
   const { setTheme, discardThemeDraft } = useAppSettingsActions();

   const editingTheme = customThemes.find((custom) => theme === customThemeClass(custom.id));

   // The escape hatch shows only while a custom theme is active (a preset can't make the UI unusable).
   const isCustomActive = customThemeIdFromClass(theme) !== null;
   // Instant bail, no confirm: a broken theme/draft is exactly what you panic-click out of. Drops to Neutral
   // and clears any draft, so the editor falls back to its placeholder and the whole app renders usable again.
   const resetToDefaultTheme = () => { setTheme('theme-neutral'); discardThemeDraft(); };

   // The draft has unsaved changes when its editor fields differ from the saved theme it belongs to.
   const draftSaved = themeDraft ? customThemes.find((entry) => entry.id === themeDraft.id) : undefined;
   const isDirty = !!(themeDraft && draftSaved && !themeEditorFieldsEqual(themeDraft, draftSaved));

   // One guard for every way of leaving the current draft (closing the window, selecting another theme,
   // Duplicate / New / Import). When dirty it parks the intended action behind a confirm; otherwise it drops
   // the (clean) draft and runs straight away. Confirming or a clean path always clears the draft first.
   const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);
   const guardedSwitch = useCallback((proceed: () => void) => {
      if (isDirty) { setPendingProceed(() => proceed); return; }
      discardThemeDraft();
      proceed();
   }, [isDirty, discardThemeDraft]);
   const confirmDiscard = () => {
      discardThemeDraft();
      const proceed = pendingProceed;
      setPendingProceed(null);
      proceed?.();
   };

   const requestOpenChange = (open: boolean) => {
      if (open) { onOpenChange(true); return; }
      guardedSwitch(() => onOpenChange(false));
   };

   const importTheme = useThemeImport();
   const onDrop = useCallback(async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      try {
         const imported = await importFromFile(file);
         guardedSwitch(() => importTheme(imported));
      } catch (error) {
         console.error('Theme import failed:', error);
         toast.error(t('Notifications.general.importFailed'));
      }
   }, [guardedSwitch, importTheme, t]);

   // Drop-only: the dialog's own clicks and keyboard must keep working, so no click activation.
   const { getRootProps, isDragActive } = useFileDrop({
      onFiles: onDrop,
      accept: '.cotm,.json',
      noClick: true,
   });

   return (
      <Dialog open={isOpen} onOpenChange={requestOpenChange}>
         {/* `p-0 gap-0` drops the dialog's own padding so each band fills edge to edge - the dividers run
             the full width/height and the three surface shades read as distinct sections. The shades use
             chrome tokens whose brightness order holds in light AND dark (and adapts to a custom theme):
             header = card (raised/brightest), list = popover (middle), editor = background (recedes). */}
         <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 gap-0 sm:max-w-5xl">
            <ThemeSwitchGuardProvider value={guardedSwitch}>
            <div {...getRootProps()} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
               <DialogHeader className="border-b border-border bg-card px-6 py-4">
                  {/* `pr-8` keeps the escape hatch clear of the dialog's own close X (top-right). */}
                  <div className="flex items-start justify-between gap-3 pr-8">
                     <div className="flex flex-col gap-1.5">
                        <DialogTitle>{t('SettingsDialog.themes.windowTitle')}</DialogTitle>
                        <DialogDescription>{t('SettingsDialog.themes.windowDescription')}</DialogDescription>
                     </div>
                     {/* FIXED colors on purpose: a broken theme or draft must never be able to hide its own
                         escape. So this uses no chrome tokens and no `dark:` variants - a white pill with a
                         border + shadow stands out on any background, light or dark. */}
                     {isCustomActive && (
                        <button
                           type="button"
                           onClick={resetToDefaultTheme}
                           title={t('SettingsDialog.themes.escapeHatch')}
                           className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 shadow-md transition-colors hover:bg-neutral-100"
                        >
                           <LifeBuoy className="h-4 w-4" />
                           {t('SettingsDialog.themes.escapeHatch')}
                        </button>
                     )}
                  </div>
               </DialogHeader>

               <div className="flex min-h-0 flex-1 overflow-hidden">
                  {/* Master: the theme list (its own panel; it owns the customs scroll). */}
                  <div className="flex w-56 shrink-0 flex-col border-r border-border bg-popover p-2">
                     <ThemeManager />
                  </div>

                  {/* Detail: the editor for the active custom theme, or a hint for an (immutable) preset. The
                      editor owns its own scroll + padding (so its Save header can stay fixed at the top). */}
                  <div className="min-w-0 flex-1 overflow-hidden bg-background">
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
            </ThemeSwitchGuardProvider>
         </DialogContent>

         {/* Leaving a dirty draft (close, or switching themes) asks before discarding, so work is never lost silently. */}
         <AlertDialog open={pendingProceed !== null} onOpenChange={(open) => { if (!open) setPendingProceed(null); }}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('SettingsDialog.themes.discardTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('SettingsDialog.themes.discardBody')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.dangerZone.resetDialog.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer">
                     {t('SettingsDialog.themes.discardConfirm')}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </Dialog>
   );
}
