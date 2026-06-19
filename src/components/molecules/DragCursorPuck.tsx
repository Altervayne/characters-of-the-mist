// -- React Imports --
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { Plus, ExternalLink, Download, Save } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { DragContext } from '@/lib/utils/dragFeedback';



/** The icon + i18n label shown for each actionable drag context. */
const PUCK_CONTENT: Record<NonNullable<DragContext>, { Icon: LucideIcon; labelKey: string }> = {
   'open-tab': { Icon: Plus, labelKey: 'DragPuck.openAsTab' },
   open: { Icon: ExternalLink, labelKey: 'DragPuck.open' },
   'add-to-sheet': { Icon: Download, labelKey: 'DragPuck.addToSheet' },
   'save-to-drawer': { Icon: Save, labelKey: 'DragPuck.saveToDrawer' },
};

/**
 * A small contextual "puck" pinned to the cursor during a drag, telling the user
 * what a drop would do (open as tab / open / add to sheet / save to drawer).
 *
 * Positioning is imperative, NOT React-driven: the parent hook writes
 * `style.left`/`style.top` on the forwarded ref every `pointermove` (cheap, no
 * re-render). React only re-renders this on a *context change* (rare), so the
 * morphing label stays in sync without driving the per-frame motion. Because the
 * wrapper's left/top are never set through the `style` prop, those re-renders do
 * not clobber the imperative writes.
 *
 * It MUST render as a sibling of @dnd-kit's `<DragOverlay>`, never a child: the
 * overlay applies a transform that would offset this `fixed` element. The puck is
 * `pointer-events-none` so it never intercepts a drop, and sits above the overlay.
 *
 * @param props.context - The current drag context; the puck is invisible while null.
 * @param ref - Forwarded to the fixed wrapper the hook positions each frame.
 */
export const DragCursorPuck = forwardRef<HTMLDivElement, { context: DragContext }>(
   function DragCursorPuck({ context }, ref) {
      const { t } = useTranslation();
      const content = context ? PUCK_CONTENT[context] : null;

      return (
         <div ref={ref} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[1000]">
            {content && (
               <div
                  className={cn(
                     // Offset just past the cursor so it never sits under the pointer.
                     'translate-x-3 translate-y-3 flex items-center gap-1.5 rounded-full',
                     'border border-border bg-popover px-2.5 py-1 text-xs font-medium',
                     'text-popover-foreground shadow-lg',
                  )}
               >
                  <content.Icon className="size-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{t(content.labelKey)}</span>
               </div>
            )}
         </div>
      );
   },
);
