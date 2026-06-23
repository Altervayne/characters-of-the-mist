// -- React Imports --
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { connectionEndpoints } from '@/lib/board/boardConnections';
import { collapsedBarRect, isConnectionCollapsedAway, resolveEndpointAnchor } from '@/lib/board/zoneCollapse';
import { pushRecentColor, readRecentColors } from '@/lib/recentColors';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';

// -- Type Imports --
import type { BoardItem, ConnectionBoardContent } from '@/lib/types/board';
import type { Point, RectLike } from '@/lib/board/boardConnections';

/*
 * The connection overlay: one SVG inside the world layer (so it shares the pan/zoom
 * transform and lines align to items at any zoom), drawn ABOVE the item boxes. The SVG
 * is `pointer-events: none` so it never blocks an item; only the lines are hittable (a
 * wide transparent stroke makes a thin line easy to click). Lines are read live from the
 * endpoint items each render, so they follow movement/resize; a connection whose
 * endpoint is missing draws nothing (no orphan line). The selected line's width/color
 * are edited from the midpoint toolbar - each change is one undoable command.
 */

/** Line-width presets (world units), thin -> thick. */
const WIDTH_PRESETS = [2, 4, 8];
/**
 * The connection's curated palette: vivid colors chosen to read on light + dark boards.
 * Deliberately distinct from the post-it pastels - the picker and recents are shared, the
 * palette is per-context. A pick from here is NOT a "custom" color, so it never joins recents.
 */
const CONNECTION_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#f97316', '#64748b', '#0f172a', '#f8fafc'] as const;

interface BoardConnectionsLayerProps {
   items: Record<string, BoardItem>;
   connections: BoardItem[];
   selectedId: string | null;
   zoom: number;
   /** The active group move (moving ids + shared world delta), or null - so lines track the live drag. */
   moving: { ids: Set<string>; delta: { x: number; y: number } } | null;
   /** Zones currently collapsed: a line to a hidden member of one re-anchors to that zone's bar. */
   collapsedZoneIds: ReadonlySet<string>;
   /** The in-progress connect drag (source item id + cursor in world coords), or null. */
   connectPreview: { fromId: string; cursor: Point } | null;
   onSelect: (id: string) => void;
   onUpdateStyle: (id: string, style: { width: number; color: string }) => void;
   onDelete: (id: string) => void;
}

export function BoardConnectionsLayer({ items, connections, selectedId, zoom, moving, collapsedZoneIds, connectPreview, onSelect, onUpdateStyle, onDelete }: BoardConnectionsLayerProps) {
   const { t } = useTranslation();

   // While an item is being dragged it renders at its position + the live delta, but the committed
   // `items` map hasn't moved yet; offset an endpoint that is in the moving set so its line follows
   // the item smoothly (both ends shift when both move, e.g. a zone carrying its members).
   const live = (item: BoardItem): BoardItem =>
      moving && moving.ids.has(item.id) ? { ...item, x: item.x + moving.delta.x, y: item.y + moving.delta.y } : item;

   // The geometry an endpoint anchors to: a hidden member of a collapsed zone (or that zone itself)
   // ends on the zone's bar - which follows the bar's own drag; everything else uses the item's live
   // rect. Render-only - the connection's from/to data is untouched.
   const endpointRect = (item: BoardItem): RectLike => {
      const { anchor, isBar } = resolveEndpointAnchor(item, items, collapsedZoneIds);
      const moved = live(anchor);
      return isBar ? collapsedBarRect(moved) : moved;
   };

   // The selected line's live color while its picker is open: shown on the line before the
   // single committed command on close (so a picker drag never floods undo).
   const [colorPreview, setColorPreview] = useState<{ id: string; color: string } | null>(null);

   // The live preview line during a connect drag: source edge -> cursor (a free end).
   const previewLine = (() => {
      if (!connectPreview) return null;
      const source = items[connectPreview.fromId];
      if (!source) return null;
      return connectionEndpoints(endpointRect(source), { x: connectPreview.cursor.x, y: connectPreview.cursor.y, width: 0, height: 0 });
   })();

   const selectedConnection = connections.find((connection) => connection.id === selectedId);

   return (
      <>
         {/* The SVG itself is inert; only the lines below opt back into pointer events. */}
         <svg className="absolute left-0 top-0" style={{ width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}>
            {connections.map((connection) => {
               const content = connection.content as ConnectionBoardContent;
               const fromItem = items[content.from];
               const toItem = items[content.to];
               // Defensive: a connection to a deleted item draws nothing (no orphan line).
               if (!fromItem || !toItem) return null;
               // Both ends collapse to the same zone's bar -> the line is a dot; don't draw it.
               if (isConnectionCollapsedAway(fromItem, toItem, items, collapsedZoneIds)) return null;

               const { from, to } = connectionEndpoints(endpointRect(fromItem), endpointRect(toItem));
               const isSelected = connection.id === selectedId;
               // Show the live picker color on the selected line; otherwise the committed color.
               const effectiveColor = colorPreview?.id === connection.id ? colorPreview.color : content.style.color;

               return (
                  <g key={connection.id}>
                     {isSelected && (
                        <line
                           x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                           stroke="var(--primary)"
                           strokeOpacity={0.35}
                           strokeWidth={content.style.width + 8 / zoom}
                           strokeLinecap="round"
                        />
                     )}
                     <line
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={effectiveColor}
                        strokeWidth={content.style.width}
                        strokeLinecap="round"
                     />
                     {/* Wide transparent hit path so a thin line is still easy to click. */}
                     <line
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke="transparent"
                        strokeWidth={Math.max(content.style.width, 14 / zoom)}
                        strokeLinecap="round"
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onPointerDown={(event: ReactPointerEvent<SVGLineElement>) => {
                           event.stopPropagation();
                           onSelect(connection.id);
                        }}
                     />
                  </g>
               );
            })}

            {previewLine && (
               <line
                  x1={previewLine.from.x} y1={previewLine.from.y} x2={previewLine.to.x} y2={previewLine.to.y}
                  stroke="var(--primary)"
                  strokeWidth={3 / zoom}
                  strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  strokeLinecap="round"
               />
            )}
         </svg>

         {/* Style control for the selected connection, at its midpoint, counter-scaled. */}
         {selectedConnection && (() => {
            const content = selectedConnection.content as ConnectionBoardContent;
            const fromItem = items[content.from];
            const toItem = items[content.to];
            if (!fromItem || !toItem) return null;
            if (isConnectionCollapsedAway(fromItem, toItem, items, collapsedZoneIds)) return null;
            const { from, to } = connectionEndpoints(endpointRect(fromItem), endpointRect(toItem));
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const effectiveColor = colorPreview?.id === selectedConnection.id ? colorPreview.color : content.style.color;

            return (
               <div
                  className="absolute"
                  style={{ left: midX, top: midY, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
                  onPointerDown={(event) => event.stopPropagation()}
               >
                  <div className="flex items-center gap-2 rounded-md border border-border bg-card/95 p-1.5 shadow-md backdrop-blur-sm">
                     <div className="flex items-center gap-1" title={t('BoardView.lineWidth')}>
                        {WIDTH_PRESETS.map((width) => (
                           <button
                              key={width}
                              type="button"
                              aria-label={`${t('BoardView.lineWidth')} ${width}`}
                              onClick={() => onUpdateStyle(selectedConnection.id, { width, color: content.style.color })}
                              className={cn(
                                 'flex h-6 w-6 items-center justify-center rounded hover:bg-muted cursor-pointer',
                                 content.style.width === width && 'bg-muted ring-1 ring-primary',
                              )}
                           >
                              <span className="rounded-full bg-foreground" style={{ width: width + 2, height: width + 2 }} />
                           </button>
                        ))}
                     </div>

                     <div className="h-5 w-px bg-border" />

                     <ConnectionColorControl
                        connectionId={selectedConnection.id}
                        style={content.style}
                        effectiveColor={effectiveColor}
                        onPreview={(color) => setColorPreview(color == null ? null : { id: selectedConnection.id, color })}
                        onUpdateStyle={onUpdateStyle}
                     />

                     <div className="h-5 w-px bg-border" />

                     <button
                        type="button"
                        aria-label={t('BoardView.deleteConnection')}
                        title={t('BoardView.deleteConnection')}
                        onClick={() => onDelete(selectedConnection.id)}
                        className="flex h-6 w-6 items-center justify-center rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                     >
                        <Trash2 className="h-3.5 w-3.5" />
                     </button>
                  </div>
               </div>
            );
         })()}
      </>
   );
}

/**
 * The connection's color control in the midpoint toolbar: a swatch trigger opening the
 * shared (portaled) color popover. The full picker previews live on the line and commits a
 * single `onUpdateStyle` on close; a curated/recent swatch commits once. Custom colors join
 * the shared recents; curated ones do not. A line always keeps a color, so there is no
 * remove (the popover hides it when no remove label is given).
 */
function ConnectionColorControl({
   connectionId,
   style,
   effectiveColor,
   onPreview,
   onUpdateStyle,
}: {
   connectionId: string;
   style: { width: number; color: string };
   effectiveColor: string;
   onPreview: (color: string | null) => void;
   onUpdateStyle: (id: string, style: { width: number; color: string }) => void;
}) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);

   // The commit reads from refs so it is correct from any close path (swatch / outside / Escape
   // / unmount) and unaffected by stale closures.
   const pendingRef = useRef<string | null>(null);
   const styleRef = useRef(style);
   useEffect(() => { styleRef.current = style; });

   const commit = useCallback(() => {
      const next = pendingRef.current;
      if (next === null) return;
      const current = styleRef.current;
      if (next !== current.color) {
         onUpdateStyle(connectionId, { width: current.width, color: next });
         // Only colors from the full picker (not a curated vivid) join the shared recents.
         if (!(CONNECTION_PALETTE as readonly string[]).includes(next)) pushRecentColor(next);
      }
      pendingRef.current = null;
      onPreview(null);
   }, [connectionId, onUpdateStyle, onPreview]);

   // Commit any pending color if the control unmounts (the connection is deselected) before
   // the popover's own dismiss fires.
   const commitRef = useRef(commit);
   useEffect(() => { commitRef.current = commit; });
   useEffect(() => () => { commitRef.current(); }, []);

   return (
      <ColorPickerPopover
         open={open}
         onOpenChange={(next) => { if (!next) commit(); setOpen(next); }}
         activeColor={effectiveColor}
         palette={CONNECTION_PALETTE}
         recent={readRecentColors()}
         recentLabel={t('BoardView.recentColors')}
         onApply={(color) => {
            // A line always has a color; an (unused) remove resolves to the first palette entry.
            const resolved = color ?? CONNECTION_PALETTE[0];
            pendingRef.current = resolved;
            onPreview(resolved);
         }}
         trigger={
            <button
               type="button"
               title={t('BoardView.lineColor')}
               aria-label={t('BoardView.lineColor')}
               onPointerDown={(event) => event.stopPropagation()}
               className="h-5 w-5 cursor-pointer rounded-full border border-border"
               style={{ backgroundColor: effectiveColor }}
            />
         }
      />
   );
}
