// -- React Imports --
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';
import { ThemePreview } from '@/components/organisms/dialogs/ThemePreview';

// -- Icon Imports --
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { parseColorToRgb, rgbToHex } from '@/lib/color';
import { readRecentColors } from '@/lib/recentColors';
import { TOKEN_GROUPS } from '@/lib/theme/themeTokens';
import { deriveFromSeeds } from '@/lib/theme/deriveTheme';
import { lowContrastPairs } from '@/lib/theme/contrastWarnings';

// -- Store Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { ChromeTokenKey, CustomTheme, FourSeeds, SeedMode, TokenSet, TwoSeeds } from '@/lib/theme/themeTokens';
import type { ContrastWarning } from '@/lib/theme/contrastWarnings';

/*
 * The per-custom theme editor: every chrome token editable for light AND dark (side by side via the shared
 * color picker), a radius slider, and two live previews (light + dark) built from real chrome. Each pick
 * commits immediately through `updateCustomTheme`, so the previews - and the whole app, if this theme is
 * active - update live. The picker speaks hex; tokens are stored as the hex it emits (valid CSS, mixes fine
 * with the presets' hsl).
 *
 * Two optional accelerants sit beside the manual rows: a collapsible seed generator (fill the whole theme
 * from an accent + neutral seed, then keep editing on top) and non-blocking low-contrast warnings on any
 * foreground that reads too faintly on its surface. Manual editing stays the first-class default.
 */

/** The radius slider range (rem); presets sit at 0.5. */
const RADIUS_MIN = 0;
const RADIUS_MAX = 1.5;
const RADIUS_STEP = 0.05;

/** The seed swatches open here when a theme has never been generated. */
const DEFAULT_ACCENT_SEED = '#2563eb';
const DEFAULT_NEUTRAL_SEED = '#6b7280';

/** Any CSS color -> `#rrggbb` so the picker (hex-based) opens on the current value. */
function toHex(color: string): string {
   const rgb = parseColorToRgb(color);
   return rgb ? rgbToHex(...rgb) : '#000000';
}

/** Restores the seed panel's inputs from a theme's saved seeds, falling back to the defaults. */
function restoreSeeds(theme: CustomTheme): { two: TwoSeeds; four: FourSeeds } {
   const two: TwoSeeds = { accent: DEFAULT_ACCENT_SEED, neutral: DEFAULT_NEUTRAL_SEED };
   const four: FourSeeds = { lightAccent: DEFAULT_ACCENT_SEED, lightNeutral: DEFAULT_NEUTRAL_SEED, darkAccent: DEFAULT_ACCENT_SEED, darkNeutral: DEFAULT_NEUTRAL_SEED };
   const seeds = theme.seeds;
   if (seeds && 'accent' in seeds) { two.accent = seeds.accent; two.neutral = seeds.neutral; }
   else if (seeds && 'lightAccent' in seeds) { Object.assign(four, seeds); }
   return { two, four };
}

/** One token's swatch for one mode: opens the shared picker, commits the chosen hex; flags low contrast. */
function TokenSwatch({ value, label, onPick, warning }: { value: string; label: string; onPick: (hex: string) => void; warning?: string }) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);
   return (
      <div className="relative">
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
         {warning && (
            <Tooltip>
               <TooltipTrigger asChild>
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
                     <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  </span>
               </TooltipTrigger>
               <TooltipContent className="max-w-56">{warning}</TooltipContent>
            </Tooltip>
         )}
      </div>
   );
}

/** A labelled seed swatch (accent / neutral) for the generator panel. */
function SeedSwatch({ label, value, onPick }: { label: string; value: string; onPick: (hex: string) => void }) {
   return (
      <div className="flex items-center gap-2">
         <span className="text-sm">{label}</span>
         <TokenSwatch value={value} label={label} onPick={onPick} />
      </div>
   );
}

/** The collapsible, secondary "generate from seeds" accelerator (manual rows stay the primary way to author). */
function SeedPanel({ theme }: { theme: CustomTheme }) {
   const { t } = useTranslation();
   const { updateCustomTheme } = useAppSettingsActions();

   const restored = restoreSeeds(theme);
   const [open, setOpen] = useState(false);
   const [mode, setMode] = useState<SeedMode>(theme.seedMode === '4-seed' ? '4-seed' : '2-seed');
   const [two, setTwo] = useState<TwoSeeds>(restored.two);
   const [four, setFour] = useState<FourSeeds>(restored.four);
   const [confirming, setConfirming] = useState(false);

   const generate = () => {
      const seeds = mode === '2-seed' ? two : four;
      const { light, dark } = deriveFromSeeds(mode, seeds);
      // Overwrite both palettes from the seeds; radius is the manual slider's, untouched here.
      updateCustomTheme(theme.id, { light, dark, seedMode: mode, seeds });
      setConfirming(false);
   };

   return (
      <div className="rounded-md border border-dashed border-border">
         <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground cursor-pointer"
         >
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{t('SettingsDialog.themes.seeds.title')}</span>
         </button>

         {open && (
            <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
               {/* Mode toggle: one pair for both modes, or one pair per mode. */}
               <div className="flex gap-1.5">
                  <Button variant={mode === '2-seed' ? 'default' : 'outline'} size="sm" onClick={() => setMode('2-seed')} className="cursor-pointer">
                     {t('SettingsDialog.themes.seeds.twoSeed')}
                  </Button>
                  <Button variant={mode === '4-seed' ? 'default' : 'outline'} size="sm" onClick={() => setMode('4-seed')} className="cursor-pointer">
                     {t('SettingsDialog.themes.seeds.fourSeed')}
                  </Button>
               </div>

               {mode === '2-seed' ? (
                  <div className="flex flex-wrap gap-4">
                     <SeedSwatch label={t('SettingsDialog.themes.seeds.accent')} value={two.accent} onPick={(hex) => setTwo((s) => ({ ...s, accent: hex }))} />
                     <SeedSwatch label={t('SettingsDialog.themes.seeds.neutral')} value={two.neutral} onPick={(hex) => setTwo((s) => ({ ...s, neutral: hex }))} />
                  </div>
               ) : (
                  <div className="flex flex-col gap-2">
                     <div className="flex flex-col gap-1.5">
                        <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('SettingsDialog.themes.lightColumn')}</span>
                        <div className="flex flex-wrap gap-4">
                           <SeedSwatch label={t('SettingsDialog.themes.seeds.accent')} value={four.lightAccent} onPick={(hex) => setFour((s) => ({ ...s, lightAccent: hex }))} />
                           <SeedSwatch label={t('SettingsDialog.themes.seeds.neutral')} value={four.lightNeutral} onPick={(hex) => setFour((s) => ({ ...s, lightNeutral: hex }))} />
                        </div>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('SettingsDialog.themes.darkColumn')}</span>
                        <div className="flex flex-wrap gap-4">
                           <SeedSwatch label={t('SettingsDialog.themes.seeds.accent')} value={four.darkAccent} onPick={(hex) => setFour((s) => ({ ...s, darkAccent: hex }))} />
                           <SeedSwatch label={t('SettingsDialog.themes.seeds.neutral')} value={four.darkNeutral} onPick={(hex) => setFour((s) => ({ ...s, darkNeutral: hex }))} />
                        </div>
                     </div>
                  </div>
               )}

               <div>
                  <Button size="sm" onClick={() => setConfirming(true)} className="cursor-pointer">{t('SettingsDialog.themes.seeds.generate')}</Button>
               </div>
            </div>
         )}

         <AlertDialog open={confirming} onOpenChange={setConfirming}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t('SettingsDialog.themes.seeds.confirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('SettingsDialog.themes.seeds.confirmDescription')}</AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">{t('SettingsDialog.dangerZone.resetDialog.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={generate} className="cursor-pointer">{t('SettingsDialog.themes.seeds.generate')}</AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </div>
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

   // Per-mode low-contrast flags, indexed by the offending foreground token so its row's swatch can mark it.
   const lightWarnings = lowContrastPairs(theme.light);
   const darkWarnings = lowContrastPairs(theme.dark);
   const byForeground = (warnings: ContrastWarning[]) => new Map(warnings.map((warning) => [warning.foreground, warning]));
   const lightByFg = byForeground(lightWarnings);
   const darkByFg = byForeground(darkWarnings);
   const warningText = (warning: ContrastWarning | undefined): string | undefined =>
      warning && t('SettingsDialog.themes.contrastWarning', {
         fg: t(`SettingsDialog.themes.tokens.${warning.foreground}`),
         bg: t(`SettingsDialog.themes.tokens.${warning.surface}`),
         ratio: warning.ratio.toFixed(1),
      });
   const summary = (count: number): string | undefined =>
      count > 0 ? t('SettingsDialog.themes.contrastSummary', { count }) : undefined;

   return (
      <div className="flex flex-col gap-4">
         {/* Live previews: real chrome under the theme's inline vars; the dark pane also carries `.dark`. */}
         <div className="flex gap-2">
            <ThemePreview tokenSet={theme.light} radius={theme.radius} dark={false} label={t('SettingsDialog.themes.previewLight')} warning={summary(lightWarnings.length)} />
            <ThemePreview tokenSet={theme.dark} radius={theme.radius} dark={true} label={t('SettingsDialog.themes.previewDark')} warning={summary(darkWarnings.length)} />
         </div>

         {/* Optional accelerator: fill everything from seeds, then keep editing the rows below on top. */}
         <SeedPanel theme={theme} />

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
                        <TokenSwatch value={theme.light[token]} label={`${t(`SettingsDialog.themes.tokens.${token}`)} · ${t('SettingsDialog.themes.lightColumn')}`} onPick={(hex) => setToken('light', token, hex)} warning={warningText(lightByFg.get(token))} />
                        <TokenSwatch value={theme.dark[token]} label={`${t(`SettingsDialog.themes.tokens.${token}`)} · ${t('SettingsDialog.themes.darkColumn')}`} onPick={(hex) => setToken('dark', token, hex)} warning={warningText(darkByFg.get(token))} />
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
