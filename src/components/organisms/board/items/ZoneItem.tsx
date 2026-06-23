// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// -- Utils Imports --
import { pushRecentColor, readRecentColors } from '@/lib/recentColors';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';

// -- Type Imports --
import type { BoardItemContent, ZoneBoardContent } from '@/lib/types/board';

/*
 * A zone's header bar: an editable label (commit on blur) and a color control that opens the
 * shared, portaled color picker. It lives at the top edge of the zone frame; the frame's body
 * is otherwise click-through, so items sitting inside a zone stay interactive - only this bar
 * (and the selection chrome) takes the pointer. Label and color each commit one undoable
 * `updateItemContent`. The collapse toggle joins this bar later.
 */

/** Tint quick-picks for a zone (rendered at low opacity behind the items). */
const ZONE_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#14b8a6', '#3b82f6', '#64748b'] as const;

interface ZoneItemProps {
   content: ZoneBoardContent;
   isSelected: boolean;
   onContentChange: (content: BoardItemContent) => void;
   onRequestSelect: () => void;
}

export function ZoneItem({ content, isSelected, onContentChange, onRequestSelect }: ZoneItemProps) {
   const { t } = useTranslation();

   const [label, setLabel] = useState(content.label ?? '');
   // Re-sync from the store on an external change (undo/redo) via adjust-state-during-render;
   // typing leaves the stored label untouched (commit is on blur) so this never clobbers it.
   const [synced, setSynced] = useState(content.label ?? '');
   if ((content.label ?? '') !== synced) {
      setSynced(content.label ?? '');
      setLabel(content.label ?? '');
   }

   const commitLabel = () => {
      const trimmed = label.trim();
      if (trimmed !== (content.label ?? '')) onContentChange({ ...content, label: trimmed || undefined });
   };

   // The in-progress color while the picker is open, committed once on close (so dragging the
   // hue doesn't flood undo). The swatch previews `pending`; the tint commits on close.
   const [pending, setPending] = useState<{ color: string | undefined } | null>(null);
   const swatchColor = pending ? pending.color : content.color;

   const pendingRef = useRef<{ color: string | undefined } | null>(null);
   const contentRef = useRef(content);
   useEffect(() => { contentRef.current = content; });

   const commitPendingColor = useCallback(() => {
      const change = pendingRef.current;
      if (!change) return;
      const next = change.color;
      const current = contentRef.current;
      if (next !== current.color) {
         onContentChange({ ...current, color: next });
         // Only colors picked from the full picker (not a curated tint) join shared recents.
         if (next && !ZONE_PALETTE.includes(next as (typeof ZONE_PALETTE)[number])) pushRecentColor(next);
      }
      pendingRef.current = null;
      setPending(null);
   }, [onContentChange]);

   // Deselecting (e.g. a canvas click that also dismisses the popover) unmounts this control;
   // commit any pending color here so the pick survives that race.
   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- commit (and clear) a pending color after the deselect render
      if (!isSelected) commitPendingColor();
   }, [isSelected, commitPendingColor]);

   return (
      <div
         onPointerDown={(event) => { event.stopPropagation(); onRequestSelect(); }}
         className="pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-1 rounded-t-lg px-1.5 py-1"
      >
         <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onFocus={onRequestSelect}
            onBlur={commitLabel}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder={t('BoardView.zoneLabelPlaceholder')}
            className="min-w-0 flex-1 truncate bg-transparent text-xs font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
         />

         {isSelected && (
            <ZoneColorControl
               activeColor={swatchColor}
               onPreview={(color) => { pendingRef.current = { color }; setPending({ color }); }}
               onCommit={commitPendingColor}
            />
         )}
      </div>
   );
}

/**
 * The zone color control: a swatch button opening the shared (portaled) color popover. Picking
 * previews on the swatch; any close (Escape, outside click, a discrete swatch/remove) commits
 * the single undoable change via `onOpenChange(false)`.
 */
function ZoneColorControl({ activeColor, onPreview, onCommit }: { activeColor: string | undefined; onPreview: (color: string | undefined) => void; onCommit: () => void }) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);

   return (
      <ColorPickerPopover
         open={open}
         onOpenChange={(next) => { if (!next) onCommit(); setOpen(next); }}
         activeColor={activeColor}
         palette={ZONE_PALETTE}
         recent={readRecentColors()}
         recentLabel={t('BoardView.recentColors')}
         removeLabel={t('BoardView.removeColor')}
         onApply={onPreview}
         trigger={
            <button
               type="button"
               title={t('BoardView.zoneColor')}
               aria-label={t('BoardView.zoneColor')}
               onPointerDown={(event) => event.stopPropagation()}
               className="h-5 w-5 shrink-0 rounded border border-border"
               style={{ backgroundColor: activeColor ?? 'transparent' }}
            />
         }
      />
   );
}
