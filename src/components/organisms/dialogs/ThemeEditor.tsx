// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';
import { ThemePreview } from '@/components/organisms/dialogs/ThemePreview';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { parseColorToRgb, rgbToHex } from '@/lib/color';
import { readRecentColors } from '@/lib/recentColors';
import { TOKEN_GROUPS } from '@/lib/theme/themeTokens';

// -- Store Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { ChromeTokenKey, CustomTheme, TokenSet } from '@/lib/theme/themeTokens';

/*
 * The per-custom theme editor: every chrome token editable for light AND dark (side by side via the shared
 * color picker), a radius slider, and two live previews (light + dark) built from real chrome. Each pick
 * commits immediately through `updateCustomTheme`, so the previews - and the whole app, if this theme is
 * active - update live. The picker speaks hex; tokens are stored as the hex it emits (valid CSS, mixes fine
 * with the presets' hsl).
 */

/** The radius slider range (rem); presets sit at 0.5. */
const RADIUS_MIN = 0;
const RADIUS_MAX = 1.5;
const RADIUS_STEP = 0.05;

/** Any CSS color -> `#rrggbb` so the picker (hex-based) opens on the current value. */
function toHex(color: string): string {
   const rgb = parseColorToRgb(color);
   return rgb ? rgbToHex(...rgb) : '#000000';
}

/** One token's swatch for one mode: opens the shared picker, commits the chosen hex. */
function TokenSwatch({ value, label, onPick }: { value: string; label: string; onPick: (hex: string) => void }) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);
   return (
      <ColorPickerPopover
         open={open}
         onOpenChange={setOpen}
         activeColor={toHex(value)}
         palette={[]}
         recent={readRecentColors()}
         recentLabel={t('BoardView.recentColors')}
         onApply={(color) => { if (color) onPick(color); }}
         trigger={
            <button
               type="button"
               aria-label={label}
               title={label}
               className="h-7 w-7 shrink-0 rounded-md border border-border cursor-pointer"
               style={{ backgroundColor: value }}
            />
         }
      />
   );
}

export function ThemeEditor({ theme }: { theme: CustomTheme }) {
   const { t } = useTranslation();
   const { updateCustomTheme } = useAppSettingsActions();

   const setToken = (mode: 'light' | 'dark', token: ChromeTokenKey, hex: string) => {
      const next: TokenSet = { ...theme[mode], [token]: hex };
      updateCustomTheme(theme.id, { [mode]: next });
   };
   const radiusValue = parseFloat(theme.radius) || 0;

   return (
      <div className="flex flex-col gap-4">
         {/* Live previews: real chrome under the theme's inline vars; the dark pane also carries `.dark`. */}
         <div className="flex gap-2">
            <ThemePreview tokenSet={theme.light} radius={theme.radius} dark={false} label={t('SettingsDialog.themes.previewLight')} />
            <ThemePreview tokenSet={theme.dark} radius={theme.radius} dark={true} label={t('SettingsDialog.themes.previewDark')} />
         </div>

         {/* Radius (one value, both modes). */}
         <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium">{t('SettingsDialog.themes.radius')}</span>
            <input
               type="range"
               min={RADIUS_MIN}
               max={RADIUS_MAX}
               step={RADIUS_STEP}
               value={radiusValue}
               onChange={(event) => updateCustomTheme(theme.id, { radius: `${event.target.value}rem` })}
               className="flex-1 cursor-pointer accent-primary"
            />
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{theme.radius}</span>
         </div>

         {/* Per-token rows, grouped; light + dark swatches side by side. */}
         <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 pl-[7.5rem]">
               <span className="w-7 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('SettingsDialog.themes.lightColumn')}</span>
               <span className="w-7 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('SettingsDialog.themes.darkColumn')}</span>
            </div>
            {TOKEN_GROUPS.map((group) => (
               <div key={group.id} className="flex flex-col gap-1">
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t(`SettingsDialog.themes.groups.${group.id}`)}</span>
                  {group.tokens.map((token) => (
                     <div key={token} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-sm">{t(`SettingsDialog.themes.tokens.${token}`)}</span>
                        <TokenSwatch value={theme.light[token]} label={`${t(`SettingsDialog.themes.tokens.${token}`)} · ${t('SettingsDialog.themes.lightColumn')}`} onPick={(hex) => setToken('light', token, hex)} />
                        <TokenSwatch value={theme.dark[token]} label={`${t(`SettingsDialog.themes.tokens.${token}`)} · ${t('SettingsDialog.themes.darkColumn')}`} onPick={(hex) => setToken('dark', token, hex)} />
                     </div>
                  ))}
               </div>
            ))}
         </div>
      </div>
   );
}

/** A note shown in the detail area when a preset (un-editable) is selected. */
export function ThemeEditorPlaceholder() {
   const { t } = useTranslation();
   return (
      <div className={cn('flex h-full items-center justify-center rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground')}>
         {t('SettingsDialog.themes.duplicateToEdit')}
      </div>
   );
}
