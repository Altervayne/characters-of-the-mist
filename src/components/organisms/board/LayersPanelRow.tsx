// -- React Imports --
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { useSortable } from '@dnd-kit/sortable';

// -- Icon Imports --
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { boardItemDisplayName, boardItemKindIcon } from '@/lib/board/boardItemDisplay';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * One layers-panel row: a drag grip (the reorder handle), the item's kind glyph, and a two-line stack - a
 * label on top, a muted metadata line below. A zone renders as a group HEADER (a collapse chevron + a tint
 * left-rail); its members nest beneath it, each carrying the same rail. Single-click selects; double-click
 * centers the canvas on the item; hovering probes it on the board. A non-zone label buffers locally and
 * commits once on blur/Enter, flushing on unmount so a board switch mid-rename never drops the edit; a zone
 * is renamed on the canvas, so its header name is read-only here.
 */
interface LayersPanelRowProps {
   item: BoardItem;
   /** The muted second line: world position plus any per-kind detail (resolved by the panel). */
   metadata: string;
   isSelected: boolean;
   /** 0 for a root item or a zone header; 1 for a nested member. */
   depth: 0 | 1;
   /** True when this row heads a zone group (drag moves the band, the chevron collapses it). */
   isZone: boolean;
   /** A zone header's collapsed state (shared with the canvas). Ignored off a zone. */
   collapsed?: boolean;
   /** The group's tint rail color (the zone's own color); undefined falls back to a theme token. */
   railColor?: string;
   /** Where the drop insertion line sits relative to this row, or null when it isn't the drop target. */
   insertion: 'before' | 'after' | null;
   /** Single-click: select this item only (no pan). */
   onSelect: (id: string) => void;
   /** Double-click: select and center the canvas on this item. */
   onActivate: (id: string) => void;
   /** Row hover -> highlight the element on the canvas (canvas hover does NOT flow back here). */
   onHover: (id: string | null) => void;
   /** Commits a rename (or clears with `undefined` to fall back to the kind-derived name). */
   onCommitLabel: (id: string, label: string | undefined) => void;
   /** Toggles a zone's collapse (shared with the canvas). Present only on zone headers. */
   onToggleCollapse?: (id: string) => void;
}

export function LayersPanelRow({ item, metadata, isSelected, depth, isZone, collapsed, railColor, insertion, onSelect, onActivate, onHover, onCommitLabel, onToggleCollapse }: LayersPanelRowProps) {
   const { t } = useTranslation();
   // The grip is the drag handle; the rest of the row stays free for click-to-select. Static strategy zeroes
   // the transform (resting rows never move), so only the source row's dim is read from `isDragging`.
   const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id: item.id });

   // The glyph resolves to one of the app's stable, module-level icon components, so the static-components
   // rule is a false positive here (same as `LinkTargetList`/`CardRenderer`).
   const Icon = boardItemKindIcon(item);
   const fallback = boardItemDisplayName(item, t);
   const rowRef = useRef<HTMLDivElement | null>(null);

   // Buffer the label; commit once on blur/Enter. Resync when the stored label changes externally (an undo).
   const stored = item.label ?? '';
   const [text, setText] = useState(stored);
   const [synced, setSynced] = useState(stored);
   if (stored !== synced) {
      setSynced(stored);
      setText(stored);
   }

   const commit = () => {
      const trimmed = text.trim();
      const next = trimmed || undefined;
      if (next !== (item.label ?? undefined)) onCommitLabel(item.id, next);
      else setText(stored); // unchanged -> settle the buffer back
   };
   // A board switch unmounts the panel without a blur; flush the buffered rename so it isn't lost.
   useCommitOnUnmount(commit);

   // Canvas selection scrolls its row into view (required on a deep stack).
   useEffect(() => {
      if (isSelected) rowRef.current?.scrollIntoView({ block: 'nearest' });
   }, [isSelected]);

   return (
      <div ref={setNodeRef} className="relative">
         {insertion && (
            <div
               aria-hidden
               className={cn('pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full bg-primary', insertion === 'before' ? '-top-px' : '-bottom-px')}
            />
         )}
         <div
            ref={rowRef}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => onActivate(item.id)}
            onPointerEnter={() => onHover(item.id)}
            onPointerLeave={() => onHover(null)}
            style={railColor ? { borderLeftColor: railColor } : undefined}
            className={cn(
               'group/row flex cursor-pointer items-center gap-1 rounded border-l-2 py-1 pr-1',
               depth === 1 ? 'pl-3' : 'pl-1.5',
               railColor ? '' : isZone || depth === 1 ? 'border-primary/40' : 'border-transparent',
               isSelected ? 'bg-muted ring-1 ring-inset ring-primary/40' : 'hover:bg-muted',
               isDragging && 'opacity-50',
            )}
         >
            <button
               type="button"
               ref={setActivatorNodeRef}
               {...attributes}
               {...listeners}
               onClick={(event) => event.stopPropagation()}
               title={t('LayersPanel.reorder')}
               aria-label={t('LayersPanel.reorder')}
               className="flex size-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
            >
               <GripVertical className="size-4" aria-hidden />
            </button>

            {isZone && onToggleCollapse && (
               <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onToggleCollapse(item.id); }}
                  title={collapsed ? t('BoardView.zoneExpand') : t('BoardView.zoneCollapse')}
                  aria-label={collapsed ? t('BoardView.zoneExpand') : t('BoardView.zoneCollapse')}
                  className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
               >
                  {collapsed ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
               </button>
            )}

            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
               {isZone ? (
                  // A zone's name is edited on the canvas header; the group node mirrors it read-only.
                  <span className={cn('truncate px-1 py-0.5 text-sm', item.content.kind === 'zone' && item.content.label?.trim() ? 'text-foreground' : 'italic text-muted-foreground')} title={fallback}>
                     {fallback}
                  </span>
               ) : (
                  // Click lands in the field to rename; the stopPropagation keeps that click from also selecting.
                  <input
                     type="text"
                     value={text}
                     placeholder={fallback}
                     title={item.label?.trim() || fallback}
                     aria-label={t('LayersPanel.renameLabel')}
                     onChange={(event) => setText(event.target.value)}
                     onClick={(event) => event.stopPropagation()}
                     onDoubleClick={(event) => event.stopPropagation()}
                     onBlur={commit}
                     onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        else if (event.key === 'Escape') {
                           setText(stored);
                           event.currentTarget.blur();
                        }
                     }}
                     className="w-full min-w-0 truncate rounded bg-transparent px-1 py-0.5 text-sm text-foreground outline-none placeholder:italic placeholder:text-muted-foreground focus:bg-background/80"
                  />
               )}
               <span className="truncate px-1 text-xs tabular-nums text-muted-foreground">{metadata}</span>
            </div>
         </div>
      </div>
   );
}
