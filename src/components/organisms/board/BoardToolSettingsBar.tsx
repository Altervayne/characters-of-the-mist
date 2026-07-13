// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Brush, Eraser, Highlighter, Layers, Minus, Pen, Pencil, Pentagon, Plus, Slash, Waypoints, type LucideIcon } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { strokeColorToCss } from '@/lib/board/drawingStyle';
import { pushRecentColor, readRecentColors } from '@/lib/recentColors';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';
import { CONNECTION_PALETTE } from './BoardConnectionsLayer';

// -- Type Imports --
import type { ActiveTool, BrushKind } from '@/lib/types/board';

/*
 * The contextual settings row for the active Draw gesture, sitting beside the mode segment in the board's
 * top-left bar (only in Draw mode). The gesture axis leads (which gesture owns the pointer); the brush set,
 * shared width dots, ink swatch, and "new layer" reset follow for the drawing brushes, and grey out
 * uniformly for the eraser. All chrome is app theme tokens; the ink swatch is the one sanctioned
 * adaptive user-hex (null = the theme foreground).
 */

/** The drawing gestures, in toolbar order, each with its glyph. Shape gestures join as their tools ship. */
const GESTURE_OPTIONS: { tool: Exclude<ActiveTool, 'select'>; icon: LucideIcon; labelKey: string }[] = [
   { tool: 'freehand', icon: Pencil, labelKey: 'gestureFreehand' },
   { tool: 'line', icon: Slash, labelKey: 'gestureLine' },
   { tool: 'freeformPolygon', icon: Waypoints, labelKey: 'gestureFreeformPolygon' },
   { tool: 'regularPolygon', icon: Pentagon, labelKey: 'gestureRegularPolygon' },
   { tool: 'eraser', icon: Eraser, labelKey: 'gestureEraser' },
];

/** The regular polygon's side-count bounds (inclusive). */
const MIN_POLYGON_SIDES = 3;
const MAX_POLYGON_SIDES = 12;

/** The brushes, in toolbar order, each with its glyph. */
const BRUSH_OPTIONS: { brush: BrushKind; icon: LucideIcon; labelKey: string }[] = [
   { brush: 'pen', icon: Pen, labelKey: 'brushPen' },
   { brush: 'brush', icon: Brush, labelKey: 'brushBrush' },
   { brush: 'highlighter', icon: Highlighter, labelKey: 'brushHighlighter' },
];

/** Width quick-picks (world px). Dots preview the size; the size is shared across every brush. */
const PEN_WIDTH_PRESETS = [2, 3, 5, 8, 12, 16];

interface BoardToolSettingsBarProps {
   tool: ActiveTool;
   onSetTool: (tool: Exclude<ActiveTool, 'select'>) => void;
   penSettings: { brush: BrushKind; color: string | null; width: number };
   onSetBrush: (brush: BrushKind) => void;
   onSetColor: (color: string | null) => void;
   onSetWidth: (width: number) => void;
   onNewLayer: () => void;
   /** Pressed state for the "new layer" button: a fresh layer is pending (the next stroke mints one). */
   newLayerArmed: boolean;
   /** The regular polygon's side count (3..12); shown as a stepper for that tool only. */
   sides: number;
   onSetSides: (sides: number) => void;
}

export function BoardToolSettingsBar({ tool, onSetTool, penSettings, onSetBrush, onSetColor, onSetWidth, onNewLayer, newLayerArmed, sides, onSetSides }: BoardToolSettingsBarProps) {
   const { t } = useTranslation();
   const activeWidth = penSettings.width;
   const erasing = tool === 'eraser';
   // The eraser carries no brush, so the brush cluster greys out - but it stays IN PLACE (inert, not hidden)
   // so toggling the eraser never reflows the bar. The controls relight the instant a drawing gesture is set.
   const inertCls = erasing ? 'pointer-events-none opacity-40' : undefined;

   return (
      <>
         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         {/* Gesture axis: which drawing gesture owns the pointer. The eraser sits inline as a peer of the
             drawing gestures - no isolating divider. */}
         <div className="flex shrink-0 items-center gap-0.5">
            {GESTURE_OPTIONS.map(({ tool: gesture, icon: Icon, labelKey }) => (
               <button
                  key={gesture}
                  type="button"
                  title={t(`BoardView.${labelKey}`)}
                  aria-label={t(`BoardView.${labelKey}`)}
                  aria-pressed={tool === gesture}
                  onClick={() => onSetTool(gesture)}
                  className={cn(
                     'flex shrink-0 items-center justify-center rounded p-1.5 hover:bg-muted cursor-pointer',
                     tool === gesture ? 'bg-muted text-foreground ring-1 ring-primary/40' : 'text-foreground',
                  )}
               >
                  <Icon className="h-4 w-4" />
               </button>
            ))}
         </div>

         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         {/* Brush set - inert while erasing, kept in place so the bar holds its shape. */}
         <div className={cn('flex shrink-0 items-center gap-0.5', inertCls)} aria-disabled={erasing || undefined}>
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

         {/* Size slot: the shared width dots - inert while erasing (the eraser radius is a fixed constant,
             so nothing swaps in; the cluster just greys out like the rest). */}
         <div className={cn('flex shrink-0 items-center gap-1', inertCls)} aria-disabled={erasing || undefined} title={t('BoardView.strokeWidth')}>
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

         {/* Ink swatch - inert while erasing. */}
         <div className={inertCls} aria-disabled={erasing || undefined}>
            <InkColorControl color={penSettings.color} onApply={onSetColor} />
         </div>

         <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

         {/* Side count: the one control specific to the regular polygon, so it shows for that tool alone. */}
         {tool === 'regularPolygon' && (
            <>
               <div className="flex shrink-0 items-center gap-0.5" title={t('BoardView.polygonSides')}>
                  <button
                     type="button"
                     aria-label={`${t('BoardView.polygonSides')} -`}
                     disabled={sides <= MIN_POLYGON_SIDES}
                     onClick={() => onSetSides(Math.max(MIN_POLYGON_SIDES, sides - 1))}
                     className="flex shrink-0 items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                  >
                     <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-5 text-center text-sm tabular-nums text-foreground">{sides}</span>
                  <button
                     type="button"
                     aria-label={`${t('BoardView.polygonSides')} +`}
                     disabled={sides >= MAX_POLYGON_SIDES}
                     onClick={() => onSetSides(Math.min(MAX_POLYGON_SIDES, sides + 1))}
                     className="flex shrink-0 items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                  >
                     <Plus className="h-4 w-4" />
                  </button>
               </div>

               <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
            </>
         )}

         {/* Starts the next stroke on a fresh layer - inert while erasing (the eraser doesn't append). Reads
             armed (pressed) while a fresh layer is pending, so "the next stroke mints one" is legible. */}
         <button
            type="button"
            title={t('BoardView.newDrawingLayer')}
            aria-label={t('BoardView.newDrawingLayer')}
            aria-pressed={newLayerArmed || undefined}
            aria-disabled={erasing || undefined}
            onClick={onNewLayer}
            className={cn(
               'flex shrink-0 items-center justify-center rounded p-1.5 text-foreground hover:bg-muted cursor-pointer',
               newLayerArmed && 'bg-muted ring-1 ring-primary/40',
               inertCls,
            )}
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
