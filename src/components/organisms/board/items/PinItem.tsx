// -- React Imports --
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// -- Utils Imports --
import { pushRecentColor, readRecentColors } from '@/lib/recentColors';

// -- Component Imports --
import { ColorPickerPopover } from '@/components/molecules/color/ColorPickerPopover';

// -- Type Imports --
import type { BoardItemContent, PinBoardContent } from '@/lib/types/board';

/*
 * A corkboard pin: a small freestanding dot whose main job is to anchor connections (pin a
 * point in empty space, then fan lines to it). It has no body content - just a domed dot -
 * and a color control in the selection toolbar. The round/borderless chrome and the absent
 * resize grip are handled by the box, which special-cases the pin kind.
 */

/** Vivid corkboard colors; a pick from here is curated, so it never joins recents. */
const PIN_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#0f172a'] as const;

interface PinItemProps {
   content: PinBoardContent;
   isSelected: boolean;
   /** The selection toolbar's action slot; the color control portals here. */
   toolbarSlot: HTMLElement | null;
   onContentChange: (content: BoardItemContent) => void;
}

export function PinItem({ content, isSelected, toolbarSlot, onContentChange }: PinItemProps) {
   // The in-progress color while the picker is open, so the dot previews live before the
   // single undoable commit on close.
   const [pending, setPending] = useState<string | null>(null);
   const color = pending ?? content.color;

   // The commit reads from refs, so it is correct from any close path (swatch / outside /
   // Escape) and from the deselect effect, unaffected by stale closures.
   const pendingRef = useRef<string | null>(null);
   const contentRef = useRef(content);
   useEffect(() => { contentRef.current = content; });

   const commitPendingColor = useCallback(() => {
      const next = pendingRef.current;
      if (next === null) return;
      if (next !== contentRef.current.color) {
         onContentChange({ kind: 'pin', color: next });
         // Only colors from the full picker (not a curated vivid) join the shared recents.
         if (!(PIN_PALETTE as readonly string[]).includes(next)) pushRecentColor(next);
      }
      pendingRef.current = null;
      setPending(null);
   }, [onContentChange]);

   // Commit a pending color if the pin is deselected (its control unmounts) before the
   // popover's own dismiss fires.
   useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- commit (and clear) a pending color after the deselect render
      if (!isSelected) commitPendingColor();
   }, [isSelected, commitPendingColor]);

   return (
      <div className="h-full w-full">
         {/* The dot: a domed top-view pin - a highlight offset to the upper-left over the body color. */}
         <div
            className="h-full w-full rounded-full"
            style={{
               background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 45%), ${color}`,
               boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(0,0,0,0.25)',
            }}
         />

         {isSelected && toolbarSlot && createPortal(
            <PinColorControl
               activeColor={content.color}
               onPreview={(picked) => { pendingRef.current = picked ?? PIN_PALETTE[0]; setPending(pendingRef.current); }}
               onCommit={commitPendingColor}
            />,
            toolbarSlot,
         )}
      </div>
   );
}

/**
 * The pin color control in the selection toolbar: a swatch button opening the shared
 * (portaled) color popover. Picking previews live; any close commits the single undoable
 * change. A pin always has a color, so there is no remove.
 */
function PinColorControl({ activeColor, onPreview, onCommit }: { activeColor: string; onPreview: (color: string | undefined) => void; onCommit: () => void }) {
   const { t } = useTranslation();
   const [open, setOpen] = useState(false);

   return (
      <ColorPickerPopover
         open={open}
         onOpenChange={(next) => { if (!next) onCommit(); setOpen(next); }}
         activeColor={activeColor}
         palette={PIN_PALETTE}
         recent={readRecentColors()}
         recentLabel={t('BoardView.recentColors')}
         onApply={onPreview}
         trigger={
            <button
               type="button"
               title={t('BoardView.pinColor')}
               aria-label={t('BoardView.pinColor')}
               onPointerDown={(event) => event.stopPropagation()}
               className="h-6 w-6 cursor-pointer rounded-full border border-border"
               style={{ backgroundColor: activeColor }}
            />
         }
      />
   );
}
