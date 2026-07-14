// -- React Imports --
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

// -- Icon Imports --
import { Layers, X } from 'lucide-react';

// -- Component Imports --
import { LayersPanelRow } from './LayersPanelRow';

// -- Utils Imports --
import { boardItemDisplayName, boardItemKindIcon, boardItemMetadata } from '@/lib/board/boardItemDisplay';
import { staticListSortingStrategy } from '@/lib/utils/dnd';
import { buildLayerRows, resolveLayerDrop } from '@/lib/board/layersReorder';

// -- Type Imports --
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { BoardItem } from '@/lib/types/board';
import type { BoardStore } from '@/lib/stores/boardStore';

/*
 * The board's layers panel: a right-edge overlay listing every element top-of-stack first, two-way synced
 * with the canvas selection/hover, with zones as collapsible group nodes and drag-to-reorder. It subscribes
 * to items/selection ONLY (never the viewport), so a pan never re-renders it. Its drag lives in its OWN
 * DndContext, scoped to this list, so the vertical reorder never collides with the app-wide drawer->canvas
 * drag; the layout stays static during a drag (a single insertion line marks the drop, resting rows don't move).
 */
interface LayersPanelProps {
   store: BoardStore;
   onClose: () => void;
   /** Single-click a row: select that item only. */
   onSelect: (id: string) => void;
   /** Double-click a row: select and center the canvas on it. */
   onActivate: (id: string) => void;
   /** Row hover -> highlight the element on the canvas. */
   onHover: (id: string | null) => void;
   /** Commits a row rename (or clears with `undefined`). */
   onCommitLabel: (id: string, label: string | undefined) => void;
   /** Reorders an item into `(zoneId, index)` within its destination scope (one undo step). */
   onReorder: (id: string, zoneId: string | null, index: number) => void;
   /** Toggles a zone's collapse (shared with the canvas). */
   onToggleZoneCollapse: (id: string) => void;
}

/** Where the insertion line sits during a drag: on a row, on its `before` (top) or `after` (bottom) edge. */
interface DropIndicator {
   overId: string;
   position: 'before' | 'after';
}

export function LayersPanel({ store, onClose, onSelect, onActivate, onHover, onCommitLabel, onReorder, onToggleZoneCollapse }: LayersPanelProps) {
   const { t } = useTranslation();
   const items = useStore(store, (state) => state.items);
   const selectedIds = useStore(store, (state) => state.selectedIds);

   // Collapse lives on each zone's content (the same field the canvas reads/writes), so the panel and the
   // canvas share ONE collapse state - no second panel-only flag.
   const collapsedZoneIds = useMemo(() => {
      const ids = new Set<string>();
      for (const item of Object.values(items)) {
         if (item.content.kind === 'zone' && item.content.collapsed) ids.add(item.id);
      }
      return ids;
   }, [items]);

   // The top-down group rows (front-first), and the sortable id list in the same order.
   const rows = useMemo(() => buildLayerRows(items, collapsedZoneIds), [items, collapsedZoneIds]);
   const rowIds = useMemo(() => rows.map((row) => row.item.id), [rows]);

   // Members per zone, so a zone row can show its count without each row walking the whole map.
   const zoneMemberCounts = useMemo(() => {
      const counts = new Map<string, number>();
      for (const item of Object.values(items)) {
         if (item.zoneId) counts.set(item.zoneId, (counts.get(item.zoneId) ?? 0) + 1);
      }
      return counts;
   }, [items]);

   // A zone's tint color (its own content color), for the group rail; undefined falls back to a theme token.
   const zoneColor = (zoneId: string | null): string | undefined => {
      if (!zoneId) return undefined;
      const zone = items[zoneId];
      return zone?.content.kind === 'zone' ? zone.content.color : undefined;
   };

   const [activeId, setActiveId] = useState<string | null>(null);
   const [indicator, setIndicator] = useState<DropIndicator | null>(null);
   // Read the live indicator inside onDragEnd without a stale closure.
   const indicatorRef = useRef<DropIndicator | null>(null);
   const setDrop = (next: DropIndicator | null) => { indicatorRef.current = next; setIndicator(next); };

   // A LOCAL drag context; the small activation distance lets a grip CLICK (select) fire without a drag.
   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
      useSensor(KeyboardSensor),
   );

   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(String(event.active.id));
      setDrop(null);
   };

   const handleDragOver = (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || over.id === active.id) { if (indicatorRef.current) setDrop(null); return; }
      // Which edge: the dragged row's live center vs the over row's center (static layout, so rects are stable).
      const activeRect = active.rect.current.translated;
      const overRect = over.rect;
      const position: 'before' | 'after' = activeRect && activeRect.top + activeRect.height / 2 < overRect.top + overRect.height / 2 ? 'before' : 'after';
      const overId = String(over.id);
      // State-on-change: only re-render when the drop edge actually moves.
      const current = indicatorRef.current;
      if (!current || current.overId !== overId || current.position !== position) setDrop({ overId, position });
   };

   const handleDragEnd = (event: DragEndEvent) => {
      const drop = indicatorRef.current;
      const draggedId = String(event.active.id);
      setActiveId(null);
      setDrop(null);
      if (!drop) return;
      const target = resolveLayerDrop(store.getState().items, draggedId, drop.overId, drop.position);
      if (target) onReorder(draggedId, target.zoneId, target.index);
   };

   const handleDragCancel = () => { setActiveId(null); setDrop(null); };

   const activeItem = activeId ? items[activeId] : null;

   return (
      <div
         onPointerDown={(event) => event.stopPropagation()}
         className="absolute inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-border bg-card shadow-sm"
      >
         <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
            <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold text-foreground">{t('LayersPanel.title')}</span>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{rows.length}</span>
            <button
               type="button"
               onClick={onClose}
               title={t('LayersPanel.close')}
               aria-label={t('LayersPanel.close')}
               className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
               <X className="size-4" />
            </button>
         </div>

         {rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
               <Layers className="size-8 opacity-40" aria-hidden />
               <p className="text-xs">{t('LayersPanel.empty')}</p>
            </div>
         ) : (
            <DndContext
               sensors={sensors}
               collisionDetection={closestCenter}
               onDragStart={handleDragStart}
               onDragOver={handleDragOver}
               onDragEnd={handleDragEnd}
               onDragCancel={handleDragCancel}
            >
               <SortableContext items={rowIds} strategy={staticListSortingStrategy}>
                  <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5">
                     {rows.map((row) => (
                        <LayersPanelRow
                           key={row.item.id}
                           item={row.item}
                           metadata={boardItemMetadata(row.item, t, zoneMemberCounts.get(row.item.id))}
                           isSelected={selectedIds.has(row.item.id)}
                           depth={row.depth}
                           isZone={row.isZone}
                           collapsed={row.isZone ? collapsedZoneIds.has(row.item.id) : undefined}
                           railColor={zoneColor(row.isZone ? row.item.id : row.scopeZoneId)}
                           insertion={indicator?.overId === row.item.id ? indicator.position : null}
                           onSelect={onSelect}
                           onActivate={onActivate}
                           onHover={onHover}
                           onCommitLabel={onCommitLabel}
                           onToggleCollapse={row.isZone ? onToggleZoneCollapse : undefined}
                        />
                     ))}
                  </div>
               </SortableContext>
               <DragOverlay dropAnimation={null}>
                  {activeItem ? <LayerDragPreview item={activeItem} t={t} /> : null}
               </DragOverlay>
            </DndContext>
         )}
      </div>
   );
}

/** The floating preview under the cursor while a row drags: the item's glyph + name, on a frosted chip. */
function LayerDragPreview({ item, t }: { item: BoardItem; t: ReturnType<typeof useTranslation>['t'] }) {
   const Icon = boardItemKindIcon(item);
   return (
      <div className="flex items-center gap-1.5 rounded border border-border bg-popover/95 px-2 py-1 text-sm text-foreground shadow-lg">
         {/* eslint-disable-next-line react-hooks/static-components */}
         <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
         <span className="truncate">{boardItemDisplayName(item, t)}</span>
      </div>
   );
}
