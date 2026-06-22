// -- React Imports --
import { type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { connectionEndpoints } from '@/lib/board/boardConnections';

// -- Type Imports --
import type { BoardItem, ConnectionBoardContent } from '@/lib/types/board';
import type { Point } from '@/lib/board/boardConnections';

/*
 * The connection overlay: one SVG inside the world layer (so it shares the pan/zoom
 * transform and lines align to items at any zoom), drawn ABOVE the item boxes. The SVG
 * is `pointer-events: none` so it never blocks an item; only the lines are hittable (a
 * wide transparent stroke makes a thin line easy to click). Lines are read live from the
 * endpoint items each render, so they follow movement/resize; a connection whose
 * endpoint is missing draws nothing (no orphan line). The selected line's width/color
 * are edited via discrete presets/swatches - each click is one undoable command.
 */

/** Line-width presets (world units), thin -> thick. */
const WIDTH_PRESETS = [2, 4, 8];
/** Colour swatches, chosen to read on both light and dark boards. */
const COLOR_SWATCHES = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#64748b', '#0f172a', '#f8fafc'];

interface BoardConnectionsLayerProps {
   items: Record<string, BoardItem>;
   connections: BoardItem[];
   selectedId: string | null;
   zoom: number;
   /** The in-progress connect drag (source item id + cursor in world coords), or null. */
   connectPreview: { fromId: string; cursor: Point } | null;
   onSelect: (id: string) => void;
   onUpdateStyle: (id: string, style: { width: number; color: string }) => void;
   onDelete: (id: string) => void;
}

export function BoardConnectionsLayer({ items, connections, selectedId, zoom, connectPreview, onSelect, onUpdateStyle, onDelete }: BoardConnectionsLayerProps) {
   const { t } = useTranslation();

   // The live preview line during a connect drag: source edge -> cursor (a free end).
   const previewLine = (() => {
      if (!connectPreview) return null;
      const source = items[connectPreview.fromId];
      if (!source) return null;
      return connectionEndpoints(source, { x: connectPreview.cursor.x, y: connectPreview.cursor.y, width: 0, height: 0 });
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

               const { from, to } = connectionEndpoints(fromItem, toItem);
               const isSelected = connection.id === selectedId;

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
                        stroke={content.style.color}
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
            const { from, to } = connectionEndpoints(fromItem, toItem);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

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

                     <div className="flex items-center gap-1" title={t('BoardView.lineColor')}>
                        {COLOR_SWATCHES.map((color) => (
                           <button
                              key={color}
                              type="button"
                              aria-label={`${t('BoardView.lineColor')} ${color}`}
                              onClick={() => onUpdateStyle(selectedConnection.id, { width: content.style.width, color })}
                              className={cn(
                                 'h-5 w-5 rounded-full border border-border cursor-pointer',
                                 content.style.color === color && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                              )}
                              style={{ backgroundColor: color }}
                           />
                        ))}
                     </div>

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
