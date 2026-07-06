// -- React Imports --
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { AlignCenter, AlignLeft, AlignRight, StretchHorizontal } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Custom Hooks --
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Local Imports --
import { parseImageHint } from '@/lib/notes/noteImageHint';

// -- Type Imports --
import type { ImageToken, NoteImageAlign } from '@/lib/notes/noteImageHint';

/*
 * The caret-anchored image inspector: a docked toolbar (NOT a modal) that appears while the textarea caret
 * sits inside an image token, editing THAT image's layout. It reuses the shipped caret-splice machinery -
 * every control rewrites the active token's hint/alt in the flat body through the callbacks. Chrome rides
 * THEME tokens (`bg-popover`/`bg-primary`/`border-border`), palette-adaptive, so it reads as app chrome
 * floating over the parchment sheet - only the document itself is paper.
 *
 * Controls: a live thumbnail (so editing raw markdown doesn't feel raw), a 4-segment align toggle, three
 * size chips (S/M/L presets), a corner drag-handle for free %-resize with a live readout, and a caption
 * (alt) input. The parent (`NoteView`) owns the body transforms; this component only renders + reports intent.
 */

/** The size preset chips per align (percent of the prose measure). `full` has no size choice. */
const SIZE_PRESETS: Record<Exclude<NoteImageAlign, 'full'>, { small: number; medium: number; large: number }> = {
   left: { small: 25, medium: 40, large: 55 },
   right: { small: 25, medium: 40, large: 55 },
   center: { small: 30, medium: 50, large: 100 },
};

const ALIGN_ICON: Record<NoteImageAlign, typeof AlignLeft> = {
   left: AlignLeft,
   center: AlignCenter,
   right: AlignRight,
   full: StretchHorizontal,
};

const ALIGN_ORDER: NoteImageAlign[] = ['left', 'center', 'right', 'full'];

interface NoteImageInspectorProps {
   /** The active image token (the one the caret sits in). */
   token: ImageToken;
   /** Width (px) of the prose column, for the drag→% math. A getter so it's read fresh on pointer-down. */
   getColumnWidth: () => number;
   /** Sets align (+ its width), reconciling auto-glue in the body. */
   onAlign: (align: NoteImageAlign, widthPct: number) => void;
   /** Sets width% only, keeping the current align (chips + drag). */
   onWidth: (widthPct: number) => void;
   /** Sets the alt text (the rendered caption). */
   onCaption: (alt: string) => void;
}

export function NoteImageInspector({ token, getColumnWidth, onAlign, onWidth, onCaption }: NoteImageInspectorProps) {
   const { t } = useTranslation();
   const { url } = useAssetObjectUrl(token.hash);
   const layout = parseImageHint(token.title);

   // The live drag readout (%), shown only while dragging the corner handle.
   const [dragPct, setDragPct] = useState<number | null>(null);
   const dragState = useRef<{ startX: number; colW: number; startPct: number } | null>(null);

   /** Clicking an align segment: floats default to their band midpoint, center keeps its width, full pins 100. */
   const handleAlign = (align: NoteImageAlign) => {
      if (align === 'full') return onAlign('full', 100);
      // Keep the current width if it's already valid for the target; else the target's medium preset.
      const width = align === layout.align ? layout.widthPct : SIZE_PRESETS[align].medium;
      onAlign(align, width);
   };

   // Plain handlers (bound to DOM spans, not memoized children) - no useCallback needed.
   const handlePointerDown = (event: React.PointerEvent) => {
      if (layout.align === 'full') return; // full has no width axis
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      dragState.current = { startX: event.clientX, colW: getColumnWidth() || 1, startPct: layout.widthPct };
      setDragPct(layout.widthPct);
   };

   const handlePointerMove = (event: React.PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      // Drag maps pointer delta to % of the column; snap to 5% steps for round numbers.
      const rawPct = state.startPct + ((event.clientX - state.startX) / state.colW) * 100;
      const snapped = Math.round(rawPct / 5) * 5;
      setDragPct(snapped);
      onWidth(snapped); // parser clamps into the align's band
   };

   const handlePointerUp = (event: React.PointerEvent) => {
      if (!dragState.current) return;
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      dragState.current = null;
      setDragPct(null);
   };

   const sizePresets = layout.align === 'full' ? null : SIZE_PRESETS[layout.align];
   const displayPct = dragPct ?? layout.widthPct;

   return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-md">
         {/* Live thumbnail + corner resize handle (the handle is hidden for full, which has no width axis). */}
         <span className="relative shrink-0">
            {url ? (
               <img src={url} alt="" className="h-14 w-14 rounded border border-border object-cover" />
            ) : (
               <span className="block h-14 w-14 rounded border border-dashed border-border" />
            )}
            {layout.align !== 'full' && (
               <span
                  role="slider"
                  aria-label={t('NoteView.imageInspector.resize')}
                  aria-valuenow={displayPct}
                  tabIndex={0}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-primary-foreground bg-primary shadow-sm"
               />
            )}
            {dragPct !== null && (
               <span className="absolute -top-6 right-0 rounded bg-popover px-1.5 py-0.5 text-xs text-popover-foreground shadow">
                  {displayPct}%
               </span>
            )}
         </span>

         {/* 4-segment align toggle. */}
         <span className="flex items-center gap-0.5" role="group" aria-label={t('NoteView.imageInspector.align')}>
            {ALIGN_ORDER.map((align) => {
               const Icon = ALIGN_ICON[align];
               const active = layout.align === align;
               return (
                  <button
                     key={align}
                     type="button"
                     onClick={() => handleAlign(align)}
                     aria-pressed={active}
                     title={t(`NoteView.imageInspector.align_${align}`)}
                     className={cn(
                        'grid h-7 w-7 place-items-center rounded',
                        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                     )}
                  >
                     <Icon className="h-4 w-4" />
                  </button>
               );
            })}
         </span>

         {/* Size chips (hidden for full). */}
         {sizePresets && (
            <span className="flex items-center gap-1" role="group" aria-label={t('NoteView.imageInspector.size')}>
               {(['small', 'medium', 'large'] as const).map((key) => {
                  const pct = sizePresets[key];
                  const active = layout.widthPct === pct;
                  return (
                     <button
                        key={key}
                        type="button"
                        onClick={() => onWidth(pct)}
                        aria-pressed={active}
                        className={cn(
                           'rounded-full border px-2.5 py-0.5 text-xs',
                           active ? 'border-transparent bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                        )}
                     >
                        {t(`NoteView.imageInspector.size_${key}`)}
                     </button>
                  );
               })}
            </span>
         )}

         {/* Caption (alt) input. */}
         <input
            type="text"
            value={token.alt}
            onChange={(event) => onCaption(event.target.value)}
            placeholder={t('NoteView.imageInspector.captionPlaceholder')}
            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none"
         />
      </div>
   );
}
