// -- React Imports --
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Hook Imports --
import { useThemeMode } from '@/hooks/useThemeMode';

// -- Other Library Imports --
import toast from 'react-hot-toast';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/components/ui/icon-button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// -- Component Imports --
import { MobileBottomSheet } from '@/components/mobile/shared/MobileBottomSheet';
import { EscapeHatchBanner } from '@/components/mobile/menu/EscapeHatchBanner';
import { ThemeSwatch } from '@/components/molecules/theme/ThemeSwatch';

// -- Icon Imports --
import { ChevronLeft, Check, MoreHorizontal, Palette, Copy, Plus, Pencil, Trash2, Upload, Download } from 'lucide-react';

// -- Utils and Store Imports --
import { cn } from '@/lib/utils';
import { PRESET_LABELS, PRESET_THEMES, customThemeClass, customThemeIdFromClass, resolveThemeTokens } from '@/lib/theme/themeTokens';
import { exportCustomTheme, importFromFile } from '@/lib/utils/export-import';
import { useThemeImport } from '@/lib/theme/useThemeImport';
import { useCreateCustomTheme } from '@/lib/theme/useCreateCustomTheme';
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { CustomTheme, PaperSet, TokenSet } from '@/lib/theme/themeTokens';
import type { ActiveTheme } from '@/lib/stores/appSettingsStore';

/*
 * The mobile Themes screen: select any theme (presets + customs), import a theme file, and manage
 * customs (rename / delete / export). Built for touch - a color-preview per row, always-visible action
 * menus, no hover. Reuses the desktop theme actions; the editor (new/duplicate/edit) is desktop-only for
 * now, so this screen only selects and imports fully-formed themes.
 */

/** A selectable theme entry: its active value, label, and the palettes its preview/duplicate draw from. */
interface ThemeEntry {
   value: ActiveTheme;
   label: string;
   isCustom: boolean;
   source: { light: TokenSet; dark: TokenSet; radius: string; paper: PaperSet };
}

interface MobileThemesProps {
   onBack?: () => void;
   onOpenEditor?: () => void;
}

export default function MobileThemes({ onBack, onOpenEditor }: MobileThemesProps) {
   const { t } = useTranslation();
   const { resolvedMode } = useThemeMode();
   const activeTheme = useAppSettingsStore((state) => state.theme);
   const customThemes = useAppSettingsStore((state) => state.customThemes);
   const { setTheme, updateCustomTheme, deleteCustomTheme } = useAppSettingsActions();
   const createCustomFrom = useCreateCustomTheme();

   const [renamingId, setRenamingId] = useState<string | null>(null);
   const [renameDraft, setRenameDraft] = useState('');
   const [pendingDelete, setPendingDelete] = useState<CustomTheme | null>(null);

   const importInputRef = useRef<HTMLInputElement>(null);
   const importFormRef = useRef<HTMLFormElement>(null);
   const importTheme = useThemeImport();

   const isCustomActive = customThemeIdFromClass(activeTheme) !== null;

   const presetEntries: ThemeEntry[] = Object.keys(PRESET_LABELS).map((value) => ({
      value: value as ActiveTheme,
      label: PRESET_LABELS[value],
      isCustom: false,
      source: PRESET_THEMES[value],
   }));
   const customEntries: ThemeEntry[] = customThemes.map((theme) => ({
      value: customThemeClass(theme.id),
      label: theme.name,
      isCustom: true,
      source: { light: theme.light, dark: theme.dark, radius: theme.radius, paper: theme.paper },
   }));

   // Edit a custom: select it if it is not the active one, then open the editor (which edits the active custom).
   const editTheme = (entry: ThemeEntry) => {
      if (activeTheme !== entry.value) setTheme(entry.value);
      onOpenEditor?.();
   };
   // Duplicate any entry into a new editable custom (created + selected), then open the editor on it.
   const duplicateTheme = (entry: ThemeEntry) => {
      createCustomFrom(entry.source, t('SettingsDialog.themes.copyName', { name: entry.label }));
      onOpenEditor?.();
   };
   // Start a fresh custom from the Neutral preset, then open the editor on it.
   const createNewTheme = () => {
      createCustomFrom(PRESET_THEMES['theme-neutral'], t('SettingsDialog.themes.newThemeName'));
      onOpenEditor?.();
   };

   const startRename = (id: string, current: string) => { setRenamingId(id); setRenameDraft(current); };
   const commitRename = () => {
      const trimmed = renameDraft.trim();
      if (renamingId && trimmed) updateCustomTheme(renamingId, { name: trimmed });
      setRenamingId(null);
   };

   const exportTheme = async (id: string) => {
      const theme = customThemes.find((entry) => entry.id === id);
      if (!theme) return;
      try {
         await exportCustomTheme(theme);
         toast.success(t('Notifications.theme.exported'));
      } catch (error) {
         console.error('Theme export failed:', error);
         toast.error(t('Notifications.general.exportError'));
      }
   };

   const handleImportFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
         const imported = await importFromFile(file);
         importTheme(imported);
      } catch (error) {
         console.error('Theme import failed:', error);
         toast.error(t('Notifications.general.importFailed'));
      }
      importFormRef.current?.reset();
   };

   const renderRow = (entry: ThemeEntry) => {
      const isActive = activeTheme === entry.value;
      const customId = entry.isCustom ? customThemeIdFromClass(entry.value) : null;
      return (
         <div
            key={entry.value}
            onClick={() => { if (!isActive) setTheme(entry.value); }}
            className={cn(
               'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3',
               isActive ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted',
            )}
         >
            {/* Row previews follow the app's current appearance, so a theme reads as it actually renders right now. */}
            <ThemeSwatch tokens={resolveThemeTokens(entry.source, resolvedMode)} />
            <span className="min-w-0 flex-1 truncate text-base font-medium">{entry.label}</span>
            {isActive && <Check className="h-5 w-5 shrink-0 text-primary" />}
            <DropdownMenu>
               <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                  <Button variant="ghost" size="icon" aria-label={t('SettingsDialog.themes.actionsMenu')} className="h-11 w-11 shrink-0 cursor-pointer">
                     <MoreHorizontal className="h-5 w-5" />
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
                  {/* Presets can only be duplicated (into an editable custom); customs also edit/rename/delete. */}
                  {customId && (
                     <DropdownMenuItem onClick={() => editTheme(entry)} className="cursor-pointer">
                        <Palette className="mr-2 h-4 w-4" /><span>{t('SettingsDialog.themes.edit')}</span>
                     </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => duplicateTheme(entry)} className="cursor-pointer">
                     <Copy className="mr-2 h-4 w-4" /><span>{t('SettingsDialog.themes.duplicate')}</span>
                  </DropdownMenuItem>
                  {customId && (
                     <>
                        <DropdownMenuItem onClick={() => startRename(customId, entry.label)} className="cursor-pointer">
                           <Pencil className="mr-2 h-4 w-4" /><span>{t('SettingsDialog.themes.rename')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportTheme(customId)} className="cursor-pointer">
                           <Upload className="mr-2 h-4 w-4" /><span>{t('SettingsDialog.themes.export')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                           onClick={() => setPendingDelete(customThemes.find((theme) => theme.id === customId) ?? null)}
                           className="cursor-pointer text-destructive"
                        >
                           <Trash2 className="mr-2 h-4 w-4" /><span>{t('SettingsDialog.themes.delete')}</span>
                        </DropdownMenuItem>
                     </>
                  )}
               </DropdownMenuContent>
            </DropdownMenu>
         </div>
      );
   };

   const newButton = (
      <Button className="w-full h-12 justify-start text-base" onClick={createNewTheme}>
         <Plus className="mr-3 h-5 w-5 shrink-0" />
         <span>{t('SettingsDialog.themes.newTheme')}</span>
      </Button>
   );
   const importButton = (
      <Button variant="outline" className="w-full h-12 justify-start text-base" onClick={() => importInputRef.current?.click()}>
         <Download className="mr-3 h-5 w-5 shrink-0" />
         <span>{t('SettingsDialog.themes.importTheme')}</span>
      </Button>
   );

   return (
      <div className="h-full flex flex-col overflow-y-auto pt-safe">
         <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
               {onBack && (
                  <IconButton variant="ghost" size="lg" onClick={onBack} className="h-10 w-10 p-0">
                     <ChevronLeft className="h-8 w-8" />
                  </IconButton>
               )}
               <h2 className="flex-1 text-2xl font-bold">{t('SettingsDialog.themes.windowTitle')}</h2>
            </div>
         </div>

         {/* Reset banner, shown only while a custom theme is active. */}
         {isCustomActive && (
            <div className="px-6 pb-2">
               <EscapeHatchBanner onReset={() => setTheme('theme-neutral')} />
            </div>
         )}

         <div className="flex-1 px-6 pb-6 space-y-6">
            {/* Presets */}
            <div className="space-y-2">
               <Label className="text-sm font-semibold">{t('SettingsDialog.themes.presetsHeading')}</Label>
               <div className="space-y-2">{presetEntries.map(renderRow)}</div>
            </div>

            {/* Customs */}
            <div className="space-y-2">
               <Label className="text-sm font-semibold">{t('SettingsDialog.themes.customsHeading')}</Label>
               {customEntries.length > 0 ? (
                  <>
                     <div className="space-y-2">{customEntries.map(renderRow)}</div>
                     {newButton}
                     {importButton}
                  </>
               ) : (
                  <div className="space-y-2">
                     <p className="text-sm text-muted-foreground">{t('SettingsDialog.themes.noCustomsMobile')}</p>
                     {newButton}
                     {importButton}
                  </div>
               )}
            </div>
         </div>

         {/* Rename: a bottom-sheet prompt with an autofocused input. */}
         <MobileBottomSheet isOpen={renamingId !== null} onClose={() => setRenamingId(null)}>
            <div className="p-4 pb-3 border-b border-border">
               <h2 className="text-lg font-semibold">{t('SettingsDialog.themes.rename')}</h2>
            </div>
            <div className="p-4 space-y-4">
               <Input
                  autoFocus
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') commitRename(); }}
                  placeholder={t('SettingsDialog.themes.renamePlaceholder')}
                  className="text-base"
               />
               <div className="flex gap-2 pb-safe">
                  <Button variant="outline" onClick={() => setRenamingId(null)} className="flex-1 h-11 cursor-pointer">
                     {t('SettingsDialog.dangerZone.resetDialog.cancel')}
                  </Button>
                  <Button onClick={commitRename} disabled={!renameDraft.trim()} className="flex-1 h-11 cursor-pointer">
                     {t('SettingsDialog.themes.save')}
                  </Button>
               </div>
            </div>
         </MobileBottomSheet>

         {/* Delete: a bottom-sheet confirm; deleting the active custom falls back to a preset. */}
         <MobileBottomSheet isOpen={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
            <div className="p-4 pb-3 border-b border-border">
               <h2 className="text-lg font-semibold">{t('SettingsDialog.themes.deleteConfirmTitle')}</h2>
               <p className="text-sm text-muted-foreground mt-2">{t('SettingsDialog.themes.deleteConfirmDescription', { name: pendingDelete?.name ?? '' })}</p>
            </div>
            <div className="p-4">
               <div className="flex gap-2 pb-safe">
                  <Button variant="outline" onClick={() => setPendingDelete(null)} className="flex-1 h-11 cursor-pointer">
                     {t('SettingsDialog.dangerZone.resetDialog.cancel')}
                  </Button>
                  <Button
                     variant="destructive"
                     onClick={() => { if (pendingDelete) deleteCustomTheme(pendingDelete.id); setPendingDelete(null); }}
                     className="flex-1 h-11 cursor-pointer"
                  >
                     {t('SettingsDialog.themes.deleteConfirmButton')}
                  </Button>
               </div>
            </div>
         </MobileBottomSheet>

         <form ref={importFormRef} className="hidden">
            <input type="file" ref={importInputRef} onChange={handleImportFileSelected} accept=".cotm,application/json" />
         </form>
      </div>
   );
}
