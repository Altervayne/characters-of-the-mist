// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// -- Icon Imports --
import { Check, Copy, Pencil, Trash2, X } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { PRESET_LABELS, PRESET_THEMES, customThemeClass } from '@/lib/theme/themeTokens';

// -- Store Imports --
import { useAppSettingsStore, useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { CustomTheme, TokenSet } from '@/lib/theme/themeTokens';
import type { ActiveTheme } from '@/lib/stores/appSettingsStore';

/*
 * The theme manager: the 4 presets + every custom theme, all selectable. Any entry can be DUPLICATED into a
 * new custom (a copy of its resolved token sets - the on-ramp to a custom theme until the editor lands);
 * customs can be renamed + deleted (presets are immutable). Selecting applies immediately via the store +
 * the runtime ThemeClassManager. The light/dark control is separate (it stays in the Settings dialog).
 */

/** A selectable theme entry: its active value, label, and the token sets a duplicate copies. */
interface ThemeEntry {
   value: ActiveTheme;
   label: string;
   isCustom: boolean;
   source: { light: TokenSet; dark: TokenSet; radius: string };
}

export function ThemeManager() {
   const { t } = useTranslation();
   const activeTheme = useAppSettingsStore((state) => state.theme);
   const customThemes = useAppSettingsStore((state) => state.customThemes);
   const { setTheme, addCustomTheme, updateCustomTheme, deleteCustomTheme } = useAppSettingsActions();

   const [renamingId, setRenamingId] = useState<string | null>(null);
   const [renameDraft, setRenameDraft] = useState('');
   const [pendingDelete, setPendingDelete] = useState<CustomTheme | null>(null);

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
      source: { light: theme.light, dark: theme.dark, radius: theme.radius },
   }));
   const entries = [...presetEntries, ...customEntries];

   // Duplicate ANY entry into a new, independent custom (deep-copied token sets), then select it.
   const duplicate = (entry: ThemeEntry) => {
      const id = cuid();
      addCustomTheme({
         id,
         name: t('SettingsDialog.themes.copyName', { name: entry.label }),
         light: { ...entry.source.light },
         dark: { ...entry.source.dark },
         radius: entry.source.radius,
      });
      setTheme(customThemeClass(id));
   };

   const startRename = (id: string, current: string) => { setRenamingId(id); setRenameDraft(current); };
   const commitRename = (id: string) => {
      const trimmed = renameDraft.trim();
      if (trimmed) updateCustomTheme(id, { name: trimmed });
      setRenamingId(null);
   };

   return (
      <div className="flex flex-col gap-1.5">
         {entries.map((entry) => {
            const isActive = activeTheme === entry.value;
            const customId = entry.isCustom ? entry.value.replace('theme-custom-', '') : null;
            const isRenaming = customId !== null && renamingId === customId;

            return (
               <div key={entry.value} className="flex items-center gap-1.5">
                  {isRenaming && customId ? (
                     <>
                        <Input
                           autoFocus
                           value={renameDraft}
                           onChange={(event) => setRenameDraft(event.target.value)}
                           onKeyDown={(event) => { if (event.key === 'Enter') commitRename(customId); if (event.key === 'Escape') setRenamingId(null); }}
                           placeholder={t('SettingsDialog.themes.renamePlaceholder')}
                           className="h-9 flex-1"
                        />
                        <Button variant="default" size="icon" onClick={() => commitRename(customId)} title={t('SettingsDialog.themes.save')} className="shrink-0 cursor-pointer">
                           <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setRenamingId(null)} title={t('SettingsDialog.dangerZone.resetDialog.cancel')} className="shrink-0 cursor-pointer">
                           <X className="h-4 w-4" />
                        </Button>
                     </>
                  ) : (
                     <>
                        {/* Selecting applies the theme immediately; the active one reads as a filled button. */}
                        <Button
                           variant={isActive ? 'default' : 'outline'}
                           onClick={() => setTheme(entry.value)}
                           className="flex-1 min-w-0 justify-start cursor-pointer"
                        >
                           <span className="truncate">{entry.label}</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => duplicate(entry)} title={t('SettingsDialog.themes.duplicate')} className="shrink-0 cursor-pointer">
                           <Copy className="h-4 w-4" />
                        </Button>
                        {entry.isCustom && customId && (
                           <>
                              <Button variant="ghost" size="icon" onClick={() => startRename(customId, entry.label)} title={t('SettingsDialog.themes.rename')} className="shrink-0 cursor-pointer">
                                 <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                 variant="ghost"
                                 size="icon"
                                 onClick={() => setPendingDelete(customThemes.find((theme) => theme.id === customId) ?? null)}
                                 title={t('SettingsDialog.themes.delete')}
                                 className={cn('shrink-0 cursor-pointer text-muted-foreground hover:text-destructive')}
                              >
                                 <Trash2 className="h-4 w-4" />
                              </Button>
                           </>
                        )}
                     </>
                  )}
               </div>
            );
         })}

         <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('SettingsDialog.themes.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                     {t('SettingsDialog.themes.deleteConfirmDescription', { name: pendingDelete?.name ?? '' })}
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.dangerZone.resetDialog.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                     onClick={() => { if (pendingDelete) deleteCustomTheme(pendingDelete.id); setPendingDelete(null); }}
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  >
                     {t('SettingsDialog.themes.deleteConfirmButton')}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
   );
}
