// -- React Imports --
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useStore } from 'zustand';

// -- Icon Imports --
import { Layers, X } from 'lucide-react';

// -- Component Imports --
import { LayersPanelRow } from './LayersPanelRow';

// -- Utils Imports --
import { boardItemMetadata } from '@/lib/board/boardItemDisplay';

// -- Type Imports --
import type { BoardStore } from '@/lib/stores/boardStore';

/*
 * The board's layers panel: a right-edge overlay listing every element top-of-stack first, two-way synced
 * with the canvas selection/hover. Read-only for now - a flat stored-z index with inline rename; drag
 * reorder, zone grouping, and drawing merge come later. It subscribes to items/selection/hover ONLY (never
 * the viewport), so a pan never re-renders it.
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
}

export function LayersPanel({ store, onClose, onSelect, onActivate, onHover, onCommitLabel }: LayersPanelProps) {
   const { t } = useTranslation();
   const items = useStore(store, (state) => state.items);
   const selectedIds = useStore(store, (state) => state.selectedIds);

   // Flat stored-z order, top-of-stack first; connections aren't spatial, so they're excluded.
   const rows = useMemo(
      () => Object.values(items).filter((item) => item.kind !== 'connection').sort((a, b) => b.z - a.z),
      [items],
   );

   // Members per zone, so a zone row can show its count without each row walking the whole map.
   const zoneMemberCounts = useMemo(() => {
      const counts = new Map<string, number>();
      for (const item of Object.values(items)) {
         if (item.zoneId) counts.set(item.zoneId, (counts.get(item.zoneId) ?? 0) + 1);
      }
      return counts;
   }, [items]);

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
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5">
               {rows.map((item) => (
                  <LayersPanelRow
                     key={item.id}
                     item={item}
                     metadata={boardItemMetadata(item, t, zoneMemberCounts.get(item.id))}
                     isSelected={selectedIds.has(item.id)}
                     onSelect={onSelect}
                     onActivate={onActivate}
                     onHover={onHover}
                     onCommitLabel={onCommitLabel}
                  />
               ))}
            </div>
         )}
      </div>
   );
}
