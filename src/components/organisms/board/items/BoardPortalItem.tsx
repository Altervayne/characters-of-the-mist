// -- React Imports --
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ArrowUpRight, Pencil } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { resolvePortalIcon, portalDestinationIcon, portalOutcomeKey } from '@/lib/board/portalIcons';
import { portalFontPx, portalIconPx, portalIconOnlyPx } from '@/lib/board/portalSizing';

// -- Store and Hook Imports --
import { usePortalActivation } from '@/hooks/usePortalActivation';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';

// -- Type Imports --
import type { BoardItem, PortalBoardContent, PortalStyle } from '@/lib/types/board';

/*
 * A board PORTAL tile: a source-less NAVIGATOR that reads like a BUTTON (chrome, not paper). It renders only
 * the author's own label + chosen visual - never the target's live content - across four styles driven by
 * `PortalStyle` (text-only pill / icon+text / icon-only square / image+text poster). Its navigator signal is
 * the trio the whole element hangs off: a hover-lift toward `--primary` (nothing else on the board does this),
 * an always-present muted corner destination glyph ("opens X"), and an outcome tooltip naming the action.
 *
 * The tile is user-resizable in every style (it joins the resizable set), so its glyph + type SCALE with the
 * box - crisply, from real px derived off the measured box height (never a `transform: scale`, which blurs).
 * The label truncates at the box width; an icon-only face scales as a square off the shorter side; a poster
 * fills (`object-cover`). The shared {@link PortalCard} render is reused by the restyle editor's live preview.
 *
 * Gesture (the board invariant): single-click SELECTS (the box owns that, so the tile can be moved/restyled/
 * deleted), DOUBLE-CLICK the face ACTIVATES; a hover-revealed launch glyph also activates on single-click
 * (stop-prop) for discoverability. The box supplies the selection ring; this tile owns its surface + states.
 */

interface BoardPortalItemProps {
   item: BoardItem;
   content: PortalBoardContent;
   /** In the selection set: gates the toolbar Edit affordance. */
   isSelected: boolean;
   /** The selection toolbar's per-kind action slot; the Edit affordance portals here. Null when unselected. */
   toolbarSlot: HTMLElement | null;
   /** Opens the restyle editor window, anchored at the click point. */
   onRequestEdit: (itemId: string, screen: { x: number; y: number }) => void;
}

export function BoardPortalItem({ item, content, isSelected, toolbarSlot, onRequestEdit }: BoardPortalItemProps) {
   const { t } = useTranslation();
   const activate = usePortalActivation(item.id, content);
   const { target, style } = content;

   // Measure the RENDERED box (it fills the item box, which resizes live via CSS during a drag), so the
   // glyph + type rescale continuously as the box grows - not just on the pointer-up commit. Seeded from the
   // stored size so the first paint is already correct.
   const rootRef = useRef<HTMLDivElement>(null);
   const [size, setSize] = useState({ width: item.width, height: item.height });
   useEffect(() => {
      const el = rootRef.current;
      if (!el) return;
      const observer = new ResizeObserver(() => setSize({ width: el.offsetWidth, height: el.offsetHeight }));
      observer.observe(el);
      return () => observer.disconnect();
   }, []);

   // The outcome tooltip names the ACTION, and the caption (when any) trails it: "Open board: The Keep". An
   // icon-only portal folds its label into this title + aria, its only text home.
   const outcome = t(portalOutcomeKey(target));
   const tooltip = style.label ? `${outcome}: ${style.label}` : outcome;

   return (
      <div
         ref={rootRef}
         onDoubleClick={activate}
         title={tooltip}
         aria-label={tooltip}
         className="group relative h-full w-full cursor-pointer select-none"
      >
         <PortalCard content={content} size={size} interactive />

         {/* Hover-revealed launch affordance: a single-click here activates (stop-prop, so it never selects). */}
         <button
            type="button"
            title={outcome}
            aria-label={outcome}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); activate(); }}
            className="absolute left-1 top-1 flex items-center justify-center rounded p-0.5 text-primary opacity-0 transition-opacity hover:bg-primary/10 group-hover:opacity-100"
         >
            <ArrowUpRight className="h-3.5 w-3.5" />
         </button>

         {/* Restyle affordance (selected only): opens the movable editor window anchored at the click point. */}
         {isSelected && toolbarSlot && createPortal(
            <button
               type="button"
               title={t('BoardView.editPortal')}
               aria-label={t('BoardView.editPortal')}
               onPointerDown={(event) => event.stopPropagation()}
               onClick={(event) => { event.stopPropagation(); onRequestEdit(item.id, { x: event.clientX, y: event.clientY }); }}
               className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
               <Pencil className="h-4 w-4" />
            </button>,
            toolbarSlot,
         )}
      </div>
   );
}

/**
 * The portal's visual card: the button-like chrome plus the style-driven face + the muted corner destination
 * glyph. Purely presentational and size-driven, so both the board tile and the editor's live preview render
 * the exact same look. `interactive` adds the hover-lift toward `--primary` (the board tile; the preview is
 * static). The box owns the selection ring; this owns the surface, border, and rounding.
 */
export function PortalCard({ content, size, interactive = false }: { content: PortalBoardContent; size: { width: number; height: number }; interactive?: boolean }) {
   const { target, style } = content;
   // The corner destination glyph is dynamically resolved (static-components is a false positive here, as in
   // the drawer rows).
   const DestinationIcon = portalDestinationIcon(target);
   const isImage = style.visual?.kind === 'image';
   return (
      <div
         className={cn(
            'relative flex h-full w-full items-center justify-center overflow-hidden rounded-md border shadow-sm transition-colors',
            // Chrome, not paper: an app-theme card face that lifts toward `--primary` on hover - the one board
            // element that reacts to the cursor like a button.
            isImage ? 'border-border bg-muted' : 'border-border bg-card text-card-foreground',
            interactive && !isImage && 'group-hover:border-primary/50 group-hover:bg-primary/5',
         )}
      >
         <PortalFace style={style} size={size} />

         {/* Always-present muted destination glyph: which KIND of thing this opens. */}
         {/* eslint-disable-next-line react-hooks/static-components */}
         <DestinationIcon className="pointer-events-none absolute right-1 top-1 h-3.5 w-3.5 text-muted-foreground/80" />
      </div>
   );
}

/** Renders the interior for the portal's chosen style, sizing the glyph + type off the box (crisp px). */
function PortalFace({ style, size }: { style: PortalStyle; size: { width: number; height: number } }) {
   const { visual, label } = style;
   const fontPx = portalFontPx(size.height);

   if (visual?.kind === 'image') return <PosterFace assetId={visual.assetId} label={label} fontPx={fontPx} />;

   if (visual?.kind === 'icon') {
      const Icon = resolvePortalIcon(visual.icon);
      // Icon-only: a compact square scaled off the shorter side, the label lives only in the tooltip + aria.
      if (!label) {
         const iconPx = portalIconOnlyPx(size.width, size.height);
         return (
            <span className="flex items-center justify-center">
               {/* eslint-disable-next-line react-hooks/static-components */}
               <Icon style={{ width: iconPx, height: iconPx }} className="text-foreground" />
            </span>
         );
      }
      // Icon + text: the glyph sits before a label that truncates at the box width.
      const iconPx = portalIconPx(size.height);
      return (
         <span className="flex w-full min-w-0 items-center justify-center" style={{ gap: fontPx * 0.4, paddingInline: fontPx * 0.85, paddingBlock: fontPx * 0.4 }}>
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon style={{ width: iconPx, height: iconPx }} className="shrink-0 text-foreground" />
            <span className="min-w-0 truncate font-medium" style={{ fontSize: fontPx }}>{label}</span>
         </span>
      );
   }

   // Text-only pill: the label truncates at the box width.
   return (
      <span className="flex w-full min-w-0 items-center justify-center" style={{ paddingInline: fontPx * 0.9, paddingBlock: fontPx * 0.4 }}>
         <span className="min-w-0 truncate font-medium" style={{ fontSize: fontPx }}>{label}</span>
      </span>
   );
}

/** The image+text poster: the asset fills the box (`object-cover`); the label sits on a bottom gradient scrim. */
function PosterFace({ assetId, label, fontPx }: { assetId: string; label: string; fontPx: number }) {
   const { url } = useAssetObjectUrl(assetId);
   return (
      <div className="relative h-full w-full">
         {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
         {label && (
            <span
               className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 font-medium text-white"
               style={{ fontSize: fontPx }}
            >
               <span className="line-clamp-2">{label}</span>
            </span>
         )}
      </div>
   );
}
