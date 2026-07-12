// -- React Imports --
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ArrowUpRight, Link2Off, Pencil, Replace, Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { resolvePortalIcon, portalDestinationIcon, portalOutcomeKey } from '@/lib/board/portalIcons';
import { portalFontPx, portalIconPx, portalIconOnlyPx, portalImageThumbPx, portalLabelMaxLines, portalAlignFlexDirection, PORTAL_IMAGE_SIZE_DEFAULT } from '@/lib/board/portalSizing';
import { isPortalDead, portalDeadLabel, portalLivenessTarget } from '@/lib/board/portalLiveness';

// -- Store and Hook Imports --
import { usePortalActivation } from '@/hooks/usePortalActivation';
import { useAssetObjectUrl } from '@/hooks/useAssetObjectUrl';
import { useLinkMetadata } from '@/hooks/useLinkMetadata';

// -- Type Imports --
import type { NoteHeading } from '@/lib/notes/noteOutline';
import type { BoardItem, PortalAlign, PortalBoardContent, PortalStyle } from '@/lib/types/board';

/** No headings feed a portal's liveness (it never targets a note section); a stable ref avoids re-resolving. */
const NO_HEADINGS: NoteHeading[] = [];

/*
 * A board PORTAL tile: a source-less NAVIGATOR that reads like a BUTTON (chrome, not paper). It renders only
 * the author's own label + chosen visual - never the target's live content - across five styles driven by
 * `PortalStyle` (text-only pill / icon+text / icon-only square / image+text poster / image+text composed). Its
 * navigator signal is the trio the whole element hangs off: a hover-lift toward `--primary` (nothing else on
 * the board does this), an always-present muted corner destination glyph ("opens X"), and an outcome tooltip.
 *
 * The tile is user-resizable in every style (it joins the resizable set), so its glyph + type SCALE with the
 * box - crisply, from real px derived off the measured box height (never a `transform: scale`, which blurs).
 * The label truncates at the box width; an icon-only face scales as a square off the shorter side; a poster
 * fills (`object-cover`). The two composed styles (icon+text, image+text) lay the label out on a chosen side of
 * the visual (`style.align`). The shared {@link PortalCard} render is reused by the restyle editor's preview.
 *
 * Gesture (the board invariant): single-click SELECTS (the box owns that, so the tile can be moved/restyled/
 * deleted), DOUBLE-CLICK the face ACTIVATES; a hover-revealed launch glyph also activates on single-click
 * (stop-prop) for discoverability. The box supplies the selection ring; this tile owns its surface + states.
 *
 * DEAD target: a portal points at a SAVED (drawer-backed) note/board/character/element, so `linkMetadata` is
 * the liveness oracle. On a CONFIRMED miss the tile reads as orphaned (dimmed + dashed + `Link2Off` + a struck
 * last-known label + a "target not found" tooltip), and its toolbar slot swaps the Edit pencil for a muted
 * salvage strip - Relink (retarget) + Remove. While a target resolves LIVE with a name, that name is cached into
 * `lastKnownName` (a non-undoable write) so a later deletion still has something to strike. UNKNOWN/loading reads
 * live, never a dead flash; an external target is always live (no check).
 */

interface BoardPortalItemProps {
   item: BoardItem;
   content: PortalBoardContent;
   /** In the selection set: gates the toolbar Edit/salvage affordances. */
   isSelected: boolean;
   /** The selection toolbar's per-kind action slot; the Edit/salvage affordances portal here. Null when unselected. */
   toolbarSlot: HTMLElement | null;
   /** Opens the restyle editor window, anchored at the click point. */
   onRequestEdit: (itemId: string, screen: { x: number; y: number }) => void;
   /** Opens the target picker in retarget mode (the dead portal's Relink), anchored at the click point. */
   onRequestRelink: (itemId: string, screen: { x: number; y: number }) => void;
   /** Deletes the portal (the dead portal's Remove; an undoable item delete). */
   onDelete: (itemId: string) => void;
   /** Caches the live-resolved target name into `lastKnownName` (a non-undoable, live-read-patch write). */
   onCacheName: (itemId: string, name: string) => void;
}

export function BoardPortalItem({ item, content, isSelected, toolbarSlot, onRequestEdit, onRequestRelink, onDelete, onCacheName }: BoardPortalItemProps) {
   const { t } = useTranslation();
   const activate = usePortalActivation(item.id, content);
   const { target, style } = content;

   // Liveness via the shared drawer-metadata layer (external/board-element excluded -> read live). UNKNOWN reads
   // live; dead only on a confirmed miss.
   const metadata = useLinkMetadata(portalLivenessTarget(target), NO_HEADINGS);
   const dead = isPortalDead(metadata);

   // Cache the live-resolved name into `lastKnownName` so a later deletion still has a name to strike. The store
   // action is a live-read-patch (never clobbers a concurrent edit) and change-gated (writes only a new name).
   const resolvedName = metadata?.exists ? metadata.displayName : undefined;
   useEffect(() => {
      if (resolvedName) onCacheName(item.id, resolvedName);
   }, [resolvedName, item.id, onCacheName]);

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
   // icon-only portal folds its label into this title + aria, its only text home. A dead portal names its state.
   const outcome = t(portalOutcomeKey(target));
   const tooltip = dead ? t('NoteView.linkDead') : style.label ? `${outcome}: ${style.label}` : outcome;

   return (
      <div
         ref={rootRef}
         onDoubleClick={activate}
         title={tooltip}
         aria-label={tooltip}
         className="group relative h-full w-full cursor-pointer select-none"
      >
         <PortalCard content={content} size={size} dead={dead} interactive />

         {/* Hover-revealed launch affordance: a single-click here activates (stop-prop, so it never selects). A
             dead activation still fires - it toasts via the services' `onMissing`. */}
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

         {/* Selected toolbar slot: a live portal offers Edit; a dead one swaps it for the muted salvage strip
             (Relink + Remove) - restyling a broken portal is moot until it points somewhere again. */}
         {isSelected && toolbarSlot && createPortal(
            dead ? (
               <div className="flex items-center gap-0.5">
                  <button
                     type="button"
                     title={t('BoardView.portalRelink')}
                     aria-label={t('BoardView.portalRelink')}
                     onPointerDown={(event) => event.stopPropagation()}
                     onClick={(event) => { event.stopPropagation(); onRequestRelink(item.id, { x: event.clientX, y: event.clientY }); }}
                     className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                     <Replace className="h-4 w-4" />
                  </button>
                  <button
                     type="button"
                     title={t('BoardView.portalRemove')}
                     aria-label={t('BoardView.portalRemove')}
                     onPointerDown={(event) => event.stopPropagation()}
                     onClick={(event) => { event.stopPropagation(); onDelete(item.id); }}
                     className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                     <Trash2 className="h-4 w-4" />
                  </button>
               </div>
            ) : (
               <button
                  type="button"
                  title={t('BoardView.editPortal')}
                  aria-label={t('BoardView.editPortal')}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); onRequestEdit(item.id, { x: event.clientX, y: event.clientY }); }}
                  className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
               >
                  <Pencil className="h-4 w-4" />
               </button>
            ),
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
export function PortalCard({ content, size, dead = false, interactive = false }: { content: PortalBoardContent; size: { width: number; height: number }; dead?: boolean; interactive?: boolean }) {
   const { target, style } = content;
   // The corner destination glyph is dynamically resolved (static-components is a false positive here, as in
   // the drawer rows).
   const DestinationIcon = portalDestinationIcon(target);
   // Only the poster is paper-faced (the image fills the box); the composed image rides the card chrome, like
   // the icon styles.
   const isPoster = style.visual?.kind === 'image' && style.visual.mode === 'poster';
   // Belt (not migration): a pre-field local portal has no `background`; read it as the create default (on).
   const hasBackground = style.background ?? true;
   return (
      <div
         className={cn(
            'relative flex h-full w-full items-center justify-center overflow-hidden rounded-md transition-colors',
            dead
               // Orphaned: a dimmed, dashed, muted face regardless of the portal's own background toggle - it
               // reads as broken, not as a live button (no hover-lift, no paper poster fill).
               ? 'border border-dashed border-border bg-muted/40 text-muted-foreground opacity-60'
               // Chrome, not paper: an app-theme card face that lifts toward `--primary` on hover - the one board
               // element that reacts to the cursor like a button. With the background off the face is fully
               // transparent (the bare visual/label float on the board); the box keeps the selection ring.
               : hasBackground
                 ? cn(
                      'border shadow-sm',
                      isPoster ? 'border-border bg-muted' : 'border-border bg-card text-card-foreground',
                      interactive && !isPoster && 'group-hover:border-primary/50 group-hover:bg-primary/5',
                   )
                 : cn('text-foreground', interactive && 'group-hover:bg-primary/5'),
         )}
      >
         {dead ? <DeadFace label={portalDeadLabel(style, content.lastKnownName)} size={size} /> : <PortalFace style={style} size={size} />}

         {/* Always-present muted destination glyph: which KIND of thing this opens. */}
         {/* eslint-disable-next-line react-hooks/static-components */}
         <DestinationIcon className="pointer-events-none absolute right-1 top-1 h-3.5 w-3.5 text-muted-foreground/80" />
      </div>
   );
}

/**
 * A confirmed-dead portal's interior: the note-links dead vocabulary scaled up to element size - a `Link2Off`
 * where the visual was and the last-known label struck through (dotted). An empty label (no cached name) shows
 * just the broken-link glyph, never a blank or a raw id.
 */
function DeadFace({ label, size }: { label: string; size: { width: number; height: number } }) {
   const fontPx = portalFontPx(size.height);
   const iconPx = portalIconPx(size.height);
   return (
      <span
         className="flex w-full min-w-0 items-center justify-center overflow-hidden"
         style={{ gap: fontPx * 0.4, paddingInline: fontPx * 0.85, paddingBlock: fontPx * 0.4 }}
      >
         <Link2Off style={{ width: iconPx, height: iconPx }} className="shrink-0 text-muted-foreground" />
         {label && <PortalLabel label={label} fontPx={fontPx} maxLines={portalLabelMaxLines(size.height, fontPx)} struck />}
      </span>
   );
}

/** Renders the interior for the portal's chosen style, sizing the glyph + type off the box (crisp px). */
function PortalFace({ style, size }: { style: PortalStyle; size: { width: number; height: number } }) {
   const { visual, label } = style;
   // Belt (not migration): a pre-field local portal has no `align`; read it as the create default.
   const align = style.align ?? 'right';
   const stacked = align === 'top' || align === 'bottom';
   const fontPx = portalFontPx(size.height);

   if (visual?.kind === 'image') {
      if (visual.mode === 'poster') return <PosterFace assetId={visual.assetId} label={label} fontPx={fontPx} />;
      // Image + text composed: the asset as a thumbnail (user-sized, laid out like the icon glyph) beside the
      // label. `size` is the thumbnail's fill fraction; `background` plates it or bares its transparency.
      const thumbPx = portalImageThumbPx(size.height, visual.size ?? PORTAL_IMAGE_SIZE_DEFAULT);
      const maxLines = portalLabelMaxLines(size.height, fontPx, stacked ? thumbPx + fontPx * 0.4 : 0);
      return (
         <ComposedFace
            label={label}
            fontPx={fontPx}
            align={align}
            maxLines={maxLines}
            visual={<ComposedImageVisual assetId={visual.assetId} sizePx={thumbPx} background={visual.background ?? true} />}
         />
      );
   }

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
      // Icon + text: the glyph + a wrapping label, laid out on the align side.
      const iconPx = portalIconPx(size.height);
      const maxLines = portalLabelMaxLines(size.height, fontPx, stacked ? iconPx + fontPx * 0.4 : 0);
      return (
         <ComposedFace
            label={label}
            fontPx={fontPx}
            align={align}
            maxLines={maxLines}
            visual={
               /* eslint-disable-next-line react-hooks/static-components */
               <Icon style={{ width: iconPx, height: iconPx }} className="shrink-0 text-foreground" />
            }
         />
      );
   }

   // Text-only pill: the label wraps at the box width and clamps to the box height.
   return (
      <span className="flex w-full min-w-0 items-center justify-center overflow-hidden" style={{ paddingInline: fontPx * 0.9, paddingBlock: fontPx * 0.4 }}>
         <PortalLabel label={label} fontPx={fontPx} maxLines={portalLabelMaxLines(size.height, fontPx)} />
      </span>
   );
}

/**
 * The composed visual+text interior, shared by icon+text and image+text: the visual + the label, laid out by
 * `align` (which side the label sits on). The label wraps at the box width and clamps to `maxLines`; a column
 * layout in a short box or a row layout in a narrow box degrades by clamping (the card clips - never overflows).
 */
function ComposedFace({ visual, label, fontPx, align, maxLines }: { visual: ReactNode; label: string; fontPx: number; align: PortalAlign; maxLines: number }) {
   return (
      <span
         className="flex w-full min-w-0 items-center justify-center overflow-hidden"
         style={{ flexDirection: portalAlignFlexDirection(align), gap: fontPx * 0.4, paddingInline: fontPx * 0.85, paddingBlock: fontPx * 0.4 }}
      >
         {visual}
         <PortalLabel label={label} fontPx={fontPx} maxLines={maxLines} />
      </span>
   );
}

/**
 * A portal caption that wraps at the box width and clamps to `maxLines` (honoring authored `\n` newlines) so a
 * multiline label never spills the box; the box-derived `fontPx` scales it with a resize.
 */
function PortalLabel({ label, fontPx, maxLines, struck = false }: { label: string; fontPx: number; maxLines: number; struck?: boolean }) {
   return (
      <span
         className={cn('min-w-0 max-w-full break-words text-center font-medium', struck && 'text-muted-foreground line-through decoration-dotted')}
         style={{
            fontSize: fontPx,
            whiteSpace: 'pre-wrap',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: maxLines,
            overflow: 'hidden',
         }}
      >
         {label}
      </span>
   );
}

/**
 * A composed portal's image thumbnail: a rounded square that fills (`object-cover`) and scales with the box.
 * With `background` on it sits on a framed plate (a thumbnail); off, the plate is removed so a PNG's
 * transparency shows the portal/board through.
 */
function ComposedImageVisual({ assetId, sizePx, background }: { assetId: string; sizePx: number; background: boolean }) {
   const { url } = useAssetObjectUrl(assetId);
   return (
      <span
         className={cn('shrink-0 overflow-hidden rounded', background && 'border border-border bg-muted')}
         style={{ width: sizePx, height: sizePx }}
      >
         {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
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
