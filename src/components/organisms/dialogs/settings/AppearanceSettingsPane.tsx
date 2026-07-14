// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Hook Imports --
import { useThemeMode } from '@/hooks/useThemeMode';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// -- Icon Imports --
import { Sun, Moon, Palette } from 'lucide-react';

// -- Component Imports --
import { ThemeSwatch } from '@/components/molecules/theme/ThemeSwatch';

// -- Theme Imports --
import { PRESET_LABELS, PRESET_THEMES, customThemeClass, resolveThemeTokens } from '@/lib/theme/themeTokens';
import type { ThemeTokenSource } from '@/lib/theme/themeTokens';

// -- Store and Hook Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';



/** The Appearance section: accent-theme quick-select (with live swatches), the themes manager, and light/dark. */
export function AppearanceSettingsPane() {
   const { t } = useTranslation();
   const { resolvedMode, setMode } = useThemeMode();

   const { theme: colorTheme, customThemes } = useAppSettingsStore();
   const { setTheme: setColorTheme } = useAppSettingsActions();
   const { setThemesOpen } = useAppGeneralStateActions();

   // The quick selector: presets + customs (so any theme is one click away without opening the manager). Each
   // carries its token source so the option shows a live swatch of the colors it applies in the current mode.
   const themeOptions: { value: string; label: string; source: ThemeTokenSource }[] = [
      ...Object.entries(PRESET_LABELS).map(([value, label]) => ({ value, label, source: PRESET_THEMES[value] })),
      ...customThemes.map((custom) => ({ value: customThemeClass(custom.id), label: custom.name, source: custom })),
   ];

   return (
      <div className="grid gap-6">
         <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="theme-select" className="text-left">{t('SettingsDialog.accentColor')}</Label>
            <div className="col-span-2 flex items-center gap-2">
               {/* Quick switch to any theme (presets + customs); the manager window holds the CRUD. */}
               <Select value={colorTheme} onValueChange={(value) => setColorTheme(value as typeof colorTheme)}>
                  <SelectTrigger id="theme-select" className="flex-1 min-w-0 cursor-pointer">
                     <SelectValue placeholder={t('SettingsDialog.selectThemePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                     {themeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                           <ThemeSwatch tokens={resolveThemeTokens(option.source, resolvedMode)} className="h-4 w-4 rounded-sm" />
                           {option.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
               <Button variant="outline" onClick={() => setThemesOpen(true)} title={t('SettingsDialog.themes.manage')} className="shrink-0 cursor-pointer">
                  <Palette className="h-4 w-4 shrink-0" />
                  <span className="sr-only">{t('SettingsDialog.themes.manage')}</span>
               </Button>
            </div>
         </div>

         <div className="grid grid-cols-3 items-center gap-4">
            <Label className="text-left">{t('SettingsDialog.appearance')}</Label>
            <div className="col-span-2 flex items-center gap-2">
               <Button
                  variant={resolvedMode === 'light' ? 'default' : 'outline'}
                  onClick={() => setMode('light')}
                  title={t('SettingsDialog.light')}
                  className="flex-1 min-w-0 cursor-pointer"
               >
                  <Sun className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{t('SettingsDialog.light')}</span>
               </Button>
               <Button
                  variant={resolvedMode === 'dark' ? 'default' : 'outline'}
                  onClick={() => setMode('dark')}
                  title={t('SettingsDialog.dark')}
                  className="flex-1 min-w-0 cursor-pointer"
               >
                  <Moon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{t('SettingsDialog.dark')}</span>
               </Button>
            </div>
         </div>
      </div>
   );
}
