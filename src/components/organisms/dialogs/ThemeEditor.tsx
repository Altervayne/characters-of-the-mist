// -- React Imports --
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';
import { ThemePreview } from '@/components/organisms/dialogs/ThemePreview';
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';

// -- Tracker Imports --
import { emptyTracker } from '@/lib/trackers/emptyTracker';

// -- Icon Imports --
import { AlertTriangle, ChevronDown, ChevronRight, Info, Save, Shuffle, Sparkles } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { parseColorToRgb, rgbToHex } from '@/lib/color';
import { readRecentColors } from '@/lib/recentColors';
import { PAPER_GROUPS, PAPER_TOKEN_KEYS, PRESET_LABELS, PRESET_THEMES, TOKEN_GROUPS, themeEditorFieldsEqual } from '@/lib/theme/themeTokens';
import { deriveFromGenerator, randomGeneratorSettings } from '@/lib/theme/deriveTheme';
import { useCreateCustomTheme } from '@/lib/theme/useCreateCustomTheme';
import { useThemeSwitchGuard } from '@/components/organisms/dialogs/themeSwitchGuard';
import { lowContrastPairs } from '@/lib/theme/contrastWarnings';

// -- Store Imports --
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { CSSProperties } from 'react';
import type { ChromeTokenKey, ContrastLevel, CustomTheme, GeneratorSettings, GeneratorTier, PaperSet, PaperTokenKey, SaturationLevel, SeedSet, TokenSet } from '@/lib/theme/themeTokens';
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

/** Any CSS color -> `#rrggbb` so the picker (hex-based) opens on the current value. */
function toHex(color: string): string {
   const rgb = parseColorToRgb(color);
   return rgb ? rgbToHex(...rgb) : '#000000';
}

/** A seed set with every role present, so the panel can show a value even for roles the current tier hides. */
type FullSeedSet = { primary: string; background: string; accent: string; secondary: string };

/** The seeds the panel opens on for a never-generated theme: a blue primary, a neutral surface, amber + violet. */
const DEFAULT_SEEDS: FullSeedSet = { primary: '#2563eb', background: '#6b7280', accent: '#f59e0b', secondary: '#8b5cf6' };

/** The panel state restored from a theme's `generator`, falling back to sensible defaults when there is none. */
interface GeneratorPanelState {
   tier: GeneratorTier;
   separateModes: boolean;
   saturation: SaturationLevel;
   contrast: ContrastLevel;
   light: FullSeedSet;
   dark: FullSeedSet;
}

/** Restores the generator panel from a saved theme's `generator` (splitting light/dark seeds when separate). */
function restoreGenerator(theme: CustomTheme): GeneratorPanelState {
   const g = theme.generator;
   if (!g) return { tier: 3, separateModes: false, saturation: 'balanced', contrast: 'normal', light: { ...DEFAULT_SEEDS }, dark: { ...DEFAULT_SEEDS } };
   const lightSeeds = (g.separateModes ? (g.seeds as { light: SeedSet; dark: SeedSet }).light : (g.seeds as SeedSet)) ?? {};
   const darkSeeds = (g.separateModes ? (g.seeds as { light: SeedSet; dark: SeedSet }).dark : (g.seeds as SeedSet)) ?? {};
   return {
      tier: g.tier,
      separateModes: g.separateModes,
      saturation: g.saturation,
      contrast: g.contrast,
      light: { ...DEFAULT_SEEDS, ...lightSeeds },
      dark: { ...DEFAULT_SEEDS, ...darkSeeds },
   };
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

/**
 * A live, mode-agnostic preview of the draft's paper: two REAL trackers (a Status + a Story Theme) rendered
 * read-only, so it shows exactly what game-agnostic trackers look like under the chosen paper. The wrapper
 * sets the draft's `--paper-*` vars inline; the `:root` card-* fallback is `var(--paper-*)`, so the cards'
 * card-* colors resolve to the DRAFT paper and the preview tracks edits. `isDrawerPreview` makes them
 * read-only AND drops the card-type class, so they route through the paper fallback (not a game palette).
 */
function PaperPreview({ paper }: { paper: PaperSet }) {
   const { t } = useTranslation();
   const style = Object.fromEntries(PAPER_TOKEN_KEYS.map((key) => [`--${key}`, paper[key]])) as CSSProperties;

   // Stable samples (fresh cuids only when the language changes), so the read-only preview never churns.
   const { sampleStatus, sampleStoryTheme } = useMemo(() => {
      const status = emptyTracker('STATUS');
      status.name = t('SettingsDialog.themes.paper.sampleStatus');
      status.tiers = [true, true, false, false, false, false]; // a couple active, so the ink reads on both

      const storyTheme = emptyTracker('STORY_THEME');
      storyTheme.mainTag = { id: cuid(), name: t('SettingsDialog.themes.paper.sampleTheme'), isActive: false, isScratched: false };
      storyTheme.powerTags = [{ id: cuid(), name: t('SettingsDialog.themes.paper.samplePower'), isActive: false, isScratched: false }];
      // A weakness tag so paper-destructive is exercised.
      storyTheme.weaknessTags = [{ id: cuid(), name: t('SettingsDialog.themes.paper.sampleWeakness'), isActive: false, isScratched: false }];
      return { sampleStatus: status, sampleStoryTheme: storyTheme };
   }, [t]);

   return (
      <div style={style} className="flex flex-wrap justify-center gap-4">
         <StatusTrackerCard tracker={sampleStatus} isDrawerPreview />
         <StoryThemeTrackerCard tracker={sampleStoryTheme} isDrawerPreview />
      </div>
   );
}

/**
 * One seed input for the generator, built like the editor's token rows: a label (with an optional info
 * tip) over a swatch + hex field, so seeds read and behave the same (paste, revert-on-invalid, picker sync).
 */
function SeedField({ label, info, value, onPick }: { label: string; info?: string; value: string; onPick: (hex: string) => void }) {
   return (
      <div className="flex min-w-0 flex-col gap-1">
         <div className="flex items-center gap-1">
            <span className="truncate text-sm">{label}</span>
            {info && <InfoTip text={info} />}
         </div>
         <div className="flex items-center gap-1">
            <TokenSwatch value={value} label={label} onPick={onPick} />
            <HexInput value={value} label={label} onCommit={onPick} className="min-w-0 flex-1" />
         </div>
      </div>
   );
}

/** An evenly-split segmented control (tier / saturation / contrast), with a one-line note on the active option. */
function SegmentedControl<T extends string | number>({ label, options, value, onChange }: {
   label?: string;
   options: { value: T; label: string; desc?: string }[];
   value: T;
   onChange: (value: T) => void;
}) {
   const active = options.find((option) => option.value === value);
   return (
      <div className="flex flex-col gap-1.5">
         {label && <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>}
         <div className="grid grid-cols-3 gap-1.5">
            {options.map((option) => (
               <Button key={option.value} variant={value === option.value ? 'default' : 'outline'} size="sm" onClick={() => onChange(option.value)} className="w-full cursor-pointer">
                  {option.label}
               </Button>
            ))}
         </div>
         {active?.desc && <p className="text-xs text-muted-foreground">{active.desc}</p>}
      </div>
   );
}

/** The seed inputs for one mode, gated by tier (Accent at tier>=3, Secondary at tier 4). */
function SeedGroup({ heading, seeds, onChange, tier }: { heading?: string; seeds: FullSeedSet; onChange: (next: FullSeedSet) => void; tier: GeneratorTier }) {
   const { t } = useTranslation();
   const set = (key: keyof FullSeedSet) => (hex: string) => onChange({ ...seeds, [key]: hex });
   return (
      <div className="flex flex-col gap-1.5">
         {heading && <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{heading}</span>}
         <div className="grid grid-cols-2 gap-3">
            <SeedField label={t('SettingsDialog.themes.seeds.primary')} info={t('SettingsDialog.themes.seeds.primaryInfo')} value={seeds.primary} onPick={set('primary')} />
            <SeedField label={t('SettingsDialog.themes.seeds.background')} info={t('SettingsDialog.themes.seeds.backgroundInfo')} value={seeds.background} onPick={set('background')} />
            {tier >= 3 && <SeedField label={t('SettingsDialog.themes.seeds.accent')} info={t('SettingsDialog.themes.seeds.accentInfo')} value={seeds.accent} onPick={set('accent')} />}
            {tier >= 4 && <SeedField label={t('SettingsDialog.themes.seeds.secondary')} info={t('SettingsDialog.themes.seeds.secondaryInfo')} value={seeds.secondary} onPick={set('secondary')} />}
         </div>
      </div>
   );
}

/** The collapsible, secondary "generate from seeds" accelerator (manual rows stay the primary way to author). */
function SeedPanel({ theme }: { theme: CustomTheme }) {
   const { t } = useTranslation();
   const { patchThemeDraft } = useAppSettingsActions();

   const restored = restoreGenerator(theme);
   const [open, setOpen] = useState(false);
   const [tier, setTier] = useState<GeneratorTier>(restored.tier);
   const [separateModes, setSeparateModes] = useState(restored.separateModes);
   const [saturation, setSaturation] = useState<SaturationLevel>(restored.saturation);
   const [contrast, setContrast] = useState<ContrastLevel>(restored.contrast);
   const [light, setLight] = useState<FullSeedSet>(restored.light);
   const [dark, setDark] = useState<FullSeedSet>(restored.dark);
   const [confirming, setConfirming] = useState(false);

   // Both Generate and Surprise me go through the draft (preview live, persist on Save). The `generator` is
   // recorded so the panel restores + re-generates later.
   const apply = (settings: GeneratorSettings) => {
      const { light: l, dark: d, paper } = deriveFromGenerator(settings);
      patchThemeDraft({ light: l, dark: d, paper, generator: settings });
   };
   const buildSettings = (s: { tier: GeneratorTier; separateModes: boolean; saturation: SaturationLevel; contrast: ContrastLevel; light: FullSeedSet; dark: FullSeedSet }): GeneratorSettings => ({
      tier: s.tier, separateModes: s.separateModes, saturation: s.saturation, contrast: s.contrast,
      seeds: s.separateModes ? { light: s.light, dark: s.dark } : s.light,
   });

   const generate = () => {
      apply(buildSettings({ tier, separateModes, saturation, contrast, light, dark }));
      setConfirming(false);
   };

   // Surprise me: keep the user's tier + light/dark choice, roll seeds + both axes, reflect them, generate now.
   const surprise = () => {
      const rolled = randomGeneratorSettings({ tier, separateModes });
      setSaturation(rolled.saturation);
      setContrast(rolled.contrast);
      const rolledLight = separateModes ? (rolled.seeds as { light: SeedSet; dark: SeedSet }).light : (rolled.seeds as SeedSet);
      const rolledDark = separateModes ? (rolled.seeds as { light: SeedSet; dark: SeedSet }).dark : (rolled.seeds as SeedSet);
      setLight({ ...DEFAULT_SEEDS, ...rolledLight });
      setDark({ ...DEFAULT_SEEDS, ...rolledDark });
      apply(rolled);
   };

   const saturationOptions = [
      { value: 'minimal' as const, label: t('SettingsDialog.themes.seeds.saturationMinimal'), desc: t('SettingsDialog.themes.seeds.saturationMinimalDesc') },
      { value: 'balanced' as const, label: t('SettingsDialog.themes.seeds.saturationBalanced'), desc: t('SettingsDialog.themes.seeds.saturationBalancedDesc') },
      { value: 'vivid' as const, label: t('SettingsDialog.themes.seeds.saturationVivid'), desc: t('SettingsDialog.themes.seeds.saturationVividDesc') },
   ];
   const contrastOptions = [
      { value: 'soft' as const, label: t('SettingsDialog.themes.seeds.contrastSoft'), desc: t('SettingsDialog.themes.seeds.contrastSoftDesc') },
      { value: 'normal' as const, label: t('SettingsDialog.themes.seeds.contrastNormal'), desc: t('SettingsDialog.themes.seeds.contrastNormalDesc') },
      { value: 'contrasted' as const, label: t('SettingsDialog.themes.seeds.contrastContrasted'), desc: t('SettingsDialog.themes.seeds.contrastContrastedDesc') },
   ];

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
               {/* Tier: how many seed roles to expose (Accent at 3, Secondary at 4). */}
               <SegmentedControl
                  value={tier}
                  onChange={setTier}
                  options={[
                     { value: 2, label: t('SettingsDialog.themes.seeds.tier2') },
                     { value: 3, label: t('SettingsDialog.themes.seeds.tier3') },
                     { value: 4, label: t('SettingsDialog.themes.seeds.tier4') },
                  ]}
               />

               {/* Declare light/dark separately: doubles only the SEEDS; the tier + axes stay shared. */}
               <Button variant={separateModes ? 'default' : 'outline'} size="sm" onClick={() => setSeparateModes((value) => !value)} className="w-full cursor-pointer">
                  {t('SettingsDialog.themes.seeds.separateModes')}
               </Button>

               {/* Modifier axes. */}
               <SegmentedControl label={t('SettingsDialog.themes.seeds.saturation')} value={saturation} onChange={setSaturation} options={saturationOptions} />
               <SegmentedControl label={t('SettingsDialog.themes.seeds.contrast')} value={contrast} onChange={setContrast} options={contrastOptions} />

               {/* Seeds: one group when shared, two aligned Light/Dark groups when separate. */}
               {separateModes ? (
                  <div className="flex flex-col gap-3">
                     <SeedGroup heading={t('SettingsDialog.themes.lightColumn')} seeds={light} onChange={setLight} tier={tier} />
                     <SeedGroup heading={t('SettingsDialog.themes.darkColumn')} seeds={dark} onChange={setDark} tier={tier} />
                  </div>
               ) : (
                  <SeedGroup seeds={light} onChange={setLight} tier={tier} />
               )}

               <div className="flex gap-2">
                  <Button onClick={() => setConfirming(true)} className="flex-1 cursor-pointer">{t('SettingsDialog.themes.seeds.generate')}</Button>
                  <Button variant="outline" onClick={surprise} className="flex-1 cursor-pointer">
                     <Shuffle className="mr-1 h-4 w-4" />{t('SettingsDialog.themes.seeds.surprise')}
                  </Button>
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
   const { beginThemeDraft, patchThemeDraft, saveThemeDraft } = useAppSettingsActions();
   const themeDraft = useAppSettingsStore((state) => state.themeDraft);

   // Edits live in a draft, previewed across the whole app, and only reach the saved theme on Save. Start
   // the draft from the saved theme when this editor opens or switches themes (read fresh, so a rename made
   // mid-edit isn't clobbered). The editor is keyed by id, so it re-mounts per theme.
   const themeId = theme.id;
   useEffect(() => {
      const saved = useAppSettingsStore.getState().customThemes.find((entry) => entry.id === themeId);
      if (saved) beginThemeDraft(saved);
   }, [themeId, beginThemeDraft]);

   // Render from the draft once it matches this theme; until then (first paint) fall back to the saved theme,
   // which looks identical since the draft starts as a copy.
   const draft = themeDraft && themeDraft.id === theme.id ? themeDraft : theme;
   const dirty = themeDraft !== null && themeDraft.id === theme.id && !themeEditorFieldsEqual(themeDraft, theme);

   const setToken = (mode: 'light' | 'dark', token: ChromeTokenKey, hex: string) => {
      const next: TokenSet = { ...draft[mode], [token]: hex };
      patchThemeDraft({ [mode]: next });
   };
   // Paper is mode-agnostic, so one swatch writes one value (no light/dark split).
   const setPaper = (token: PaperTokenKey, hex: string) => {
      patchThemeDraft({ paper: { ...draft.paper, [token]: hex } });
   };
   const radiusValue = parseFloat(draft.radius) || 0;

   // Per-mode low-contrast flags, indexed by the offending foreground token so its row's swatch can mark it.
   const lightWarnings = lowContrastPairs(draft.light);
   const darkWarnings = lowContrastPairs(draft.dark);
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
      <div className="flex h-full min-h-0 flex-col">
         {/* Opaque, non-scrolling header: the body scrolls beneath it. Edits preview live but only persist on
             Save, which enables only when dirty. */}
         <div className="flex shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-4 py-2">
            {dirty && <span className="text-xs text-muted-foreground">{t('SettingsDialog.themes.unsavedChanges')}</span>}
            <Button size="sm" onClick={saveThemeDraft} disabled={!dirty} className="cursor-pointer">
               <Save className="mr-1 h-4 w-4" />{t('SettingsDialog.themes.saveChanges')}
            </Button>
         </div>

         <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
         {/* Live previews: real chrome under the draft's inline vars; the dark pane also carries `.dark`. */}
         <div className="flex gap-2">
            <ThemePreview tokenSet={draft.light} radius={draft.radius} dark={false} label={t('SettingsDialog.themes.previewLight')} warning={summary(lightWarnings.length)} />
            <ThemePreview tokenSet={draft.dark} radius={draft.radius} dark={true} label={t('SettingsDialog.themes.previewDark')} warning={summary(darkWarnings.length)} />
         </div>

         {/* Optional accelerator: fill everything from seeds, then keep editing the rows below on top. */}
         <SeedPanel theme={draft} />

         {/* Radius (one value, both modes). */}
         <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm font-medium">{t('SettingsDialog.themes.radius')}</span>
            <input
               type="range"
               min={RADIUS_MIN}
               max={RADIUS_MAX}
               step={RADIUS_STEP}
               value={radiusValue}
               onChange={(event) => patchThemeDraft({ radius: `${event.target.value}rem` })}
               className="flex-1 cursor-pointer accent-primary"
            />
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{draft.radius}</span>
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
                              <TokenSwatch value={draft.light[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.lightColumn')}`} onPick={(hex) => setToken('light', token, hex)} warning={warningText(lightByFg.get(token))} />
                              <HexInput value={draft.light[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.lightColumn')}`} onCommit={(hex) => setToken('light', token, hex)} className="min-w-0 flex-1" />
                           </div>
                           <div className="flex w-24 items-center gap-1">
                              <TokenSwatch value={draft.dark[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.darkColumn')}`} onPick={(hex) => setToken('dark', token, hex)} warning={warningText(darkByFg.get(token))} />
                              <HexInput value={draft.dark[token]} label={`${tokenLabel} · ${t('SettingsDialog.themes.darkColumn')}`} onCommit={(hex) => setToken('dark', token, hex)} className="min-w-0 flex-1" />
                           </div>
                        </div>
                     );
                  })}
               </div>
            ))}
         </div>

         {/* Paper: the game-agnostic palette for "paper" elements (drawer trackers, NEUTRAL items). One value
             per token (mode-agnostic - same in light and dark), with a live mock-tracker preview. */}
         <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex flex-col gap-1">
               <span className="text-sm font-semibold">{t('SettingsDialog.themes.paper.title')}</span>
               <p className="text-xs text-muted-foreground">{t('SettingsDialog.themes.paper.intro')}</p>
            </div>

            <PaperPreview paper={draft.paper} />

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
               {PAPER_GROUPS.map((group) => (
                  <div key={group.id} className="flex flex-col gap-1 rounded-md border border-border/60 p-2">
                     <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">{t(`SettingsDialog.themes.paper.groups.${group.id}`)}</span>
                     {group.tokens.map((token) => {
                        const paperLabel = t(`SettingsDialog.themes.paper.tokens.${token}`);
                        return (
                           <div key={token} className="flex items-center gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-1">
                                 <span className="truncate text-sm">{paperLabel}</span>
                                 <InfoTip text={t(`SettingsDialog.themes.paper.tokenPurpose.${token}`)} />
                              </div>
                              <div className="flex w-24 items-center gap-1">
                                 <TokenSwatch value={draft.paper[token]} label={paperLabel} onPick={(hex) => setPaper(token, hex)} />
                                 <HexInput value={draft.paper[token]} label={paperLabel} onCommit={(hex) => setPaper(token, hex)} className="min-w-0 flex-1" />
                              </div>
                           </div>
                        );
                     })}
                  </div>
               ))}
            </div>
         </div>
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
   const guardedSwitch = useThemeSwitchGuard();

   // The placeholder only renders for an active preset, so these are defined; fall back to Neutral defensively.
   const source = PRESET_THEMES[activeTheme] ?? PRESET_THEMES['theme-neutral'];
   const label = PRESET_LABELS[activeTheme] ?? PRESET_LABELS['theme-neutral'];

   // The editor pane no longer pads its content, so the placeholder pads itself off the dialog edges.
   return (
      <div className="h-full p-4">
         <button
            type="button"
            onClick={() => guardedSwitch(() => createCustomFrom(source, t('SettingsDialog.themes.copyName', { name: label })))}
            className={cn(
               'flex h-full w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border p-6',
               'text-center text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted/40 hover:text-foreground',
            )}
         >
            {t('SettingsDialog.themes.createFromPreset', { name: label })}
         </button>
      </div>
   );
}
