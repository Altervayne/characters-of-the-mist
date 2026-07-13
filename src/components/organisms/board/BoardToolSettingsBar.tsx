// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Brush, Highlighter, Layers, Pen, type LucideIcon } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { ERASER_RADIUS, strokeColorToCss } from '@/lib/board/drawingStyle';
import { pushRecentColor, readRecentColors } from '@/lib/recentColors';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';
import { CONNECTION_PALETTE } from './BoardConnectionsLayer';

// -- Type Imports --
import type { BrushKind } from '@/lib/types/board';

/*
 * The contextual settings row for the active drawing tool, sitting beside the tool segment in the board's
 * top-left bar (only while Pen or Eraser is active). Pen mode exposes the brush set, the shared width dots,
 * the ink swatch, and a "new layer" reset; eraser mode shows its fixed radius. All chrome is app theme
 * tokens; the ink swatch is the one sanctioned adaptive user-hex (null = the theme foreground).
 */

/** The brushes, in toolbar order, each with its glyph. */
const BRUSH_OPTIONS: { brush: BrushKind; icon: LucideIcon; labelKey: string }[] = [
   { brush: 'pen', icon: Pen, labelKey: 'brushPen' },
   { brush: 'brush', icon: Brush, labelKey: 'brushBrush' },
   { brush: 'highlighter', icon: Highlighter, labelKey: 'brushHighlighter' },
];

/** Width quick-picks (world px). Dots preview the size; the size is shared across every brush. */
const PEN_WIDTH_PRESETS = [2, 3, 5, 8, 12, 16];

interface BoardToolSettingsBarProps {
   tool: 'pen' | 'eraser';
   penSettings: { brush: BrushKind; color: string | null; width: number };
   onSetBrush: (brush: BrushKind) => void;
   onSetColor: (color: string | null) => void;
   onSetWidth: (width: number) => void;
   onNewLayer: () => void;
}

export function BoardToolSettingsBar({ tool, penSettings, onSetBrush, onSetColor, onSetWidth, onNewLayer }: BoardToolSettingsBarProps) {
   const { t } = useTranslation();

   if (tool === 'eraser') {
      return (
         <>
            <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
            <span className="shrink-0 px-1.5 text-xs tabular-nums text-muted-foreground">{t('BoardView.eraserSize', { size: ERASER_RADIUS })}</span>
         </>
      );
   }

   const activeWidth = penSettings.width;
   return (
      <>
         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         {/* Brush set */}
         <div className="flex shrink-0 items-center gap-0.5">
            {BRUSH_OPTIONS.map(({ brush, icon: Icon, labelKey }) => (
               <button
                  key={brush}
                  type="button"
                  title={t(`BoardView.${labelKey}`)}
                  aria-label={t(`BoardView.${labelKey}`)}
                  aria-pressed={penSettings.brush === brush}
                  onClick={() => onSetBrush(brush)}
                  className={cn(
                     'flex shrink-0 items-center justify-center rounded p-1.5 hover:bg-muted cursor-pointer',
                     penSettings.brush === brush ? 'bg-muted text-foreground ring-1 ring-primary/40' : 'text-foreground',
                  )}
               >
                  <Icon className="h-4 w-4" />
               </button>
            ))}
         </div>

         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         {/* Shared width dots */}
         <div className="flex shrink-0 items-center gap-1" title={t('BoardView.strokeWidth')}>
            {PEN_WIDTH_PRESETS.map((width) => (
               <button
                  key={width}
                  type="button"
                  aria-label={`${t('BoardView.strokeWidth')} ${width}`}
                  onClick={() => onSetWidth(width)}
                  className={cn(
                     'flex h-6 w-6 items-center justify-center rounded hover:bg-muted cursor-pointer',
                     activeWidth === width && 'bg-muted ring-1 ring-primary',
                  )}
               >
                  <span className="rounded-full bg-foreground" style={{ width: width + 2, height: width + 2 }} />
               </button>
            ))}
         </div>

         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         <InkColorControl color={penSettings.color} onApply={onSetColor} />

         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         {/* Starts the next stroke on a fresh layer. */}
         <button
            type="button"
            title={t('BoardView.newDrawingLayer')}
            aria-label={t('BoardView.newDrawingLayer')}
            onClick={onNewLayer}
            className="flex shrink-0 items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer"
         >
            <Layers className="h-4 w-4" />
         </button>
      </>
   );
}

/**
 * The ink swatch + shared color popover for the pen's color. Mirrors the connection color control (shared
 * palette + recents, commit-on-close read from refs so any close path is correct), differing only in that
 * ink allows a null/adaptive reset via the popover's remove action - the swatch then paints the theme
 * foreground. A custom hex joins the shared recents; a curated swatch does not.
 */
function InkColorControl({ color, onApply }: { color: string | null; onApply: (color: string | null) => void }) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);
   // A local preview so the swatch reflects the pick before it commits on close (`undefined` = untouched).
   const [preview, setPreview] = useState<string | null | undefined>(undefined);

   // Read the commit from refs so it is correct from any close path (swatch / outside / Escape / unmount)
   // and unaffected by stale closures. `hasPending` distinguishes "no pick" from a null (adaptive) pick.
   const pendingRef = useRef<string | null>(null);
   const hasPendingRef = useRef(false);
   const colorRef = useRef(color);
   useEffect(() => { colorRef.current = color; });

   const commit = useCallback(() => {
      if (!hasPendingRef.current) return;
      const next = pendingRef.current;
      if (next !== colorRef.current) {
         onApply(next);
         // Only a custom hex (not a curated swatch) joins the shared recents.
         if (next && !(CONNECTION_PALETTE as readonly string[]).includes(next)) pushRecentColor(next);
      }
      hasPendingRef.current = false;
      pendingRef.current = null;
      setPreview(undefined);
   }, [onApply]);

   // Commit any pending pick if the control unmounts (the tool changes) before the popover's dismiss fires.
   const commitRef = useRef(commit);
   useEffect(() => { commitRef.current = commit; });
   useEffect(() => () => { commitRef.current(); }, []);

   const shown = preview !== undefined ? preview : color;
   return (
      <ColorPickerPopover
         open={open}
         onOpenChange={(next) => { if (!next) commit(); setOpen(next); }}
         activeColor={shown ?? undefined}
         palette={CONNECTION_PALETTE}
         recent={readRecentColors()}
         recentLabel={t('BoardView.recentColors')}
         removeLabel={t('BoardView.inkDefaultColor')}
         onApply={(picked) => { pendingRef.current = picked ?? null; hasPendingRef.current = true; setPreview(picked ?? null); }}
         trigger={
            <button
               type="button"
               title={t('BoardView.penColor')}
               aria-label={t('BoardView.penColor')}
               onPointerDown={(event) => event.stopPropagation()}
               className="h-6 w-6 cursor-pointer rounded border border-border"
               style={{ backgroundColor: strokeColorToCss(shown) }}
            />
         }
      />
   );
}
