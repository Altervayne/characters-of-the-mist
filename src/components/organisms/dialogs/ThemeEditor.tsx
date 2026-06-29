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
import { AlertTriangle, ChevronDown, ChevronRight, Info, Sparkles } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { parseColorToRgb, rgbToHex } from '@/lib/color';
import { readRecentColors } from '@/lib/recentColors';
import { PRESET_LABELS, PRESET_THEMES, TOKEN_GROUPS } from '@/lib/theme/themeTokens';
import { deriveFromSeeds } from '@/lib/theme/deriveTheme';
import { useCreateCustomTheme } from '@/lib/theme/useCreateCustomTheme';
import { lowContrastPairs } from '@/lib/theme/contrastWarnings';

// -- Store Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { ChromeTokenKey, CustomTheme, FourSeeds, SeedMode, ThreeSeeds, TokenSet, TwoSeeds } from '@/lib/theme/themeTokens';
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
/** Expressive defaults: a blue primary, a neutral surface tint, and a contrasting amber accent. */
const DEFAULT_ACCENT_CONTRAST_SEED = '#f59e0b';

/** Any CSS color -> `#rrggbb` so the picker (hex-based) opens on the current value. */
function toHex(color: string): string {
   const rgb = parseColorToRgb(color);
   return rgb ? rgbToHex(...rgb) : '#000000';
}

/** Restores the seed panel's inputs from a theme's saved seeds, falling back to the defaults. */
function restoreSeeds(theme: CustomTheme): { two: TwoSeeds; four: FourSeeds; three: ThreeSeeds } {
   const two: TwoSeeds = { accent: DEFAULT_ACCENT_SEED, neutral: DEFAULT_NEUTRAL_SEED };
   const four: FourSeeds = { lightAccent: DEFAULT_ACCENT_SEED, lightNeutral: DEFAULT_NEUTRAL_SEED, darkAccent: DEFAULT_ACCENT_SEED, darkNeutral: DEFAULT_NEUTRAL_SEED };
   const three: ThreeSeeds = { primary: DEFAULT_ACCENT_SEED, surface: DEFAULT_NEUTRAL_SEED, accent: DEFAULT_ACCENT_CONTRAST_SEED, vivid: false };
   const seeds = theme.seeds;
   // The three shapes are distinguished by their unique keys: `primary` (3-seed), `lightAccent` (4-seed),
   // `accent` (2-seed).
   if (seeds && 'primary' in seeds) { Object.assign(three, seeds); }
   else if (seeds && 'lightAccent' in seeds) { Object.assign(four, seeds); }
   else if (seeds && 'accent' in seeds) { two.accent = seeds.accent; two.neutral = seeds.neutral; }
   return { two, four, three };
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

/** A compact hex field beside a swatch: type/paste a color without opening the picker. Reverts garbage. */
function HexInput({ value, label, onCommit, className }: { value: string; label: string; onCommit: (hex: string) => void; className?: string }) {
   const hex = toHex(value);
   const [draft, setDraft] = useState(hex);
   // Re-sync when the token value changes elsewhere (the picker, a generate) - adjust-during-render pattern.
   const [synced, setSynced] = useState(hex);
   if (hex !== synced) { setSynced(hex); setDraft(hex); }

   const commit = () => {
      const rgb = parseColorToRgb(draft);
      if (rgb) onCommit(rgbToHex(...rgb)); // normalize (#rgb -> #rrggbb)
      else setDraft(hex); // invalid -> revert, never write garbage
   };
   return (
      <input
         type="text"
         aria-label={label}
         value={draft}
         spellCheck={false}
         onChange={(event) => setDraft(event.target.value)}
         onBlur={commit}
         onKeyDown={(event) => { if (event.key === 'Enter') commit(); if (event.key === 'Escape') setDraft(hex); }}
         className={cn('h-7 rounded-md border border-input bg-transparent px-1.5 font-mono text-xs tabular-nums outline-none focus:border-ring', className)}
      />
   );
}

/** A muted info icon whose tooltip explains a token's purpose (copy from the theme audit). */
function InfoTip({ text }: { text: string }) {
   return (
      <Tooltip>
         <TooltipTrigger asChild>
            <button type="button" tabIndex={-1} aria-label={text} className="shrink-0 cursor-help text-muted-foreground/60 hover:text-foreground">
               <Info className="h-3.5 w-3.5" />
            </button>
         </TooltipTrigger>
         <TooltipContent className="max-w-56">{text}</TooltipContent>
      </Tooltip>
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
   const [mode, setMode] = useState<SeedMode>(theme.seedMode === '4-seed' ? '4-seed' : theme.seedMode === '3-seed' ? '3-seed' : '2-seed');
   const [two, setTwo] = useState<TwoSeeds>(restored.two);
   const [four, setFour] = useState<FourSeeds>(restored.four);
   const [three, setThree] = useState<ThreeSeeds>(restored.three);
   const [confirming, setConfirming] = useState(false);

   const generate = () => {
      const seeds = mode === '2-seed' ? two : mode === '3-seed' ? three : four;
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
                  <Button variant={mode === '3-seed' ? 'default' : 'outline'} size="sm" onClick={() => setMode('3-seed')} className="cursor-pointer">
                     {t('SettingsDialog.themes.seeds.expressive')}
                  </Button>
               </div>

               {mode === '2-seed' ? (
                  <div className="flex flex-wrap gap-4">
                     <SeedSwatch label={t('SettingsDialog.themes.seeds.accent')} value={two.accent} onPick={(hex) => setTwo((s) => ({ ...s, accent: hex }))} />
                     <SeedSwatch label={t('SettingsDialog.themes.seeds.neutral')} value={two.neutral} onPick={(hex) => setTwo((s) => ({ ...s, neutral: hex }))} />
                  </div>
               ) : mode === '3-seed' ? (
                  <div className="flex flex-col gap-3">
                     <div className="flex flex-wrap gap-4">
                        <SeedSwatch label={t('SettingsDialog.themes.seeds.primary')} value={three.primary} onPick={(hex) => setThree((s) => ({ ...s, primary: hex }))} />
                        <SeedSwatch label={t('SettingsDialog.themes.seeds.surface')} value={three.surface} onPick={(hex) => setThree((s) => ({ ...s, surface: hex }))} />
                        <SeedSwatch label={t('SettingsDialog.themes.seeds.accent')} value={three.accent} onPick={(hex) => setThree((s) => ({ ...s, accent: hex }))} />
                     </div>
                     {/* Vivid scales the boldness (surface saturation, foreground tint, accent saturation). */}
                     <Button
                        variant={three.vivid ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setThree((s) => ({ ...s, vivid: !s.vivid }))}
                        className="w-fit cursor-pointer"
                     >
                        {t('SettingsDialog.themes.seeds.vivid')}
                     </Button>
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

         {/* Per-token rows: each surface paired with its foreground, two group-blocks per row on a wide
             window (one when narrow). Each block carries its own Light/Dark markers so the columns line up. */}
         <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
            {TOKEN_GROUPS.map((group) => (
               <div key={group.id} className="flex flex-col gap-1 rounded-md border border-border/60 p-2">
                  <div className="flex items-center gap-2">
                     <span className="min-w-0 flex-1 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t(`SettingsDialog.themes.groups.${group.id}`)}</span>
                     <span className="w-24 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('SettingsDialog.themes.lightColumn')}</span>
                     <span className="w-24 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t('SettingsDialog.themes.darkColumn')}</span>
                  </div>
                  {group.tokens.map((token) => {
                     const tokenLabel = t(`SettingsDialog.themes.tokens.${token}`);
                     return (
                        <div key={token} className="flex items-center gap-2">
                           <div className="flex min-w-0 flex-1 items-center gap-1">
                              <span className="truncate text-sm">{tokenLabel}</span>
                              <InfoTip text={t(`SettingsDialog.themes.tokenPurpose.${token}`)} />
                           </div>
                           <div className="flex w-24 items-center gap-1">
                              <TokenSwatch value={theme.light[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.lightColumn')}`} onPick={(hex) => setToken('light', token, hex)} warning={warningText(lightByFg.get(token))} />
                              <HexInput value={theme.light[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.lightColumn')}`} onCommit={(hex) => setToken('light', token, hex)} className="min-w-0 flex-1" />
                           </div>
                           <div className="flex w-24 items-center gap-1">
                              <TokenSwatch value={theme.dark[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.darkColumn')}`} onPick={(hex) => setToken('dark', token, hex)} warning={warningText(darkByFg.get(token))} />
                              <HexInput value={theme.dark[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.darkColumn')}`} onCommit={(hex) => setToken('dark', token, hex)} className="min-w-0 flex-1" />
                           </div>
                        </div>
                     );
                  })}
               </div>
            ))}
         </div>
      </div>
   );
}

/**
 * Shown in the detail area when a preset (un-editable) is active: a big clickable card that makes an editable
 * copy of the CURRENT preset and selects it, so editing is one click away without hunting for Duplicate.
 */
export function ThemeEditorPlaceholder() {
   const { t } = useTranslation();
   const activeTheme = useAppSettingsStore((state) => state.theme);
   const createCustomFrom = useCreateCustomTheme();

   // The placeholder only renders for an active preset, so these are defined; fall back to Neutral defensively.
   const source = PRESET_THEMES[activeTheme] ?? PRESET_THEMES['theme-neutral'];
   const label = PRESET_LABELS[activeTheme] ?? PRESET_LABELS['theme-neutral'];

   return (
      <button
         type="button"
         onClick={() => createCustomFrom(source, t('SettingsDialog.themes.copyName', { name: label }))}
         className={cn(
            'flex h-full w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border p-6',
            'text-center text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted/40 hover:text-foreground',
         )}
      >
         {t('SettingsDialog.themes.createFromPreset', { name: label })}
      </button>
   );
}
