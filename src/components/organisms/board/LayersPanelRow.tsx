// -- React Imports --
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { GripVertical } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { boardItemDisplayName, boardItemKindIcon } from '@/lib/board/boardItemDisplay';
import { useCommitOnUnmount } from '@/hooks/useCommitOnUnmount';

// -- Type Imports --
import type { BoardItem } from '@/lib/types/board';

/*
 * One layers-panel row: a drag grip (visual only for now), the item's kind glyph, and a two-line stack - an
 * inline-editable label on top, a muted metadata line (position, plus per-kind detail) below. Single-click
 * selects the item; double-click centers the canvas on it; hovering probes it on the board. The label buffers
 * locally and commits once on blur/Enter, flushing on unmount so a board switch mid-rename never drops the edit.
 */
interface LayersPanelRowProps {
   item: BoardItem;
   /** The muted second line: world position plus any per-kind detail (resolved by the panel). */
   metadata: string;
   isSelected: boolean;
   /** Single-click: select this item only (no pan). */
   onSelect: (id: string) => void;
   /** Double-click: select and center the canvas on this item. */
   onActivate: (id: string) => void;
   /** Row hover -> highlight the element on the canvas (canvas hover does NOT flow back here). */
   onHover: (id: string | null) => void;
   /** Commits a rename (or clears with `undefined` to fall back to the kind-derived name). */
   onCommitLabel: (id: string, label: string | undefined) => void;
}

export function LayersPanelRow({ item, metadata, isSelected, onSelect, onActivate, onHover, onCommitLabel }: LayersPanelRowProps) {
   const { t } = useTranslation();
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
      <div
         ref={rowRef}
         onClick={() => onSelect(item.id)}
         onDoubleClick={() => onActivate(item.id)}
         onPointerEnter={() => onHover(item.id)}
         onPointerLeave={() => onHover(null)}
         className={cn(
            'group/row flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1',
            isSelected ? 'bg-muted ring-1 ring-inset ring-primary/40' : 'hover:bg-muted',
         )}
      >
         <GripVertical className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
         {/* eslint-disable-next-line react-hooks/static-components */}
         <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
         <div className="flex min-w-0 flex-1 flex-col">
            {/* Click lands in the field to rename; the stopPropagation keeps that click from also selecting. */}
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
            <span className="truncate px-1 text-xs tabular-nums text-muted-foreground">{metadata}</span>
         </div>
      </div>
   );
}
