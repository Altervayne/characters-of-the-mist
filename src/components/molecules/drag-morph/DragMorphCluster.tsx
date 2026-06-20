// -- React Imports --
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { ArrowRight, ArrowUp } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { selectMorphGlyph } from '@/lib/utils/dragFeedback';

// -- Type Imports --
import type { MorphArrow, MorphDescriptor } from '@/lib/utils/dragFeedback';

/** The progress ring's radius (viewBox units); its circumference seeds the dash. */
const RING_RADIUS = 16;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Props for {@link DragMorphCluster}. */
interface DragMorphClusterProps {
   /** Whether the cluster is showing (cross-fades in); the engine's funnel state. */
   active: boolean;
   /** The active morph descriptor (action icon + label), or null when nothing actionable. */
   descriptor: MorphDescriptor | null;
   /** The dwell target key; non-null draws + restarts the progress ring (keyed off it). */
   springKey: string | null;
   /** The direction arrow to show (descriptor arrow or the spring's), or null. */
   arrow: MorphArrow;
   /** Optional opaque "what am I dragging" node, shown on the right when supplied. */
   identity?: ReactNode;
}

/**
 * The cursor cluster template (tabs polish-9), centered on the cursor dot:
 *  - **Dot**, pinned exactly on the cursor.
 *  - **Loading ring**, wraps the dot, fills over the dwell window; present only
 *    during a spring dwell (keyed off `springKey` so it restarts per target).
 *  - **Action glyph (left)**, one small filled badge: the dwell direction arrow
 *    while dwelling, otherwise the descriptor's action icon (see {@link selectMorphGlyph}).
 *  - **Dragged-item pill (right)**, the optional `identity` node, shown only when
 *    the consumer supplies it.
 *
 * Rendered as a SIBLING of `<DragOverlay>` (never a child, the overlay's transform
 * would offset this fixed element) and positioned imperatively by the engine writing
 * `style.left/top` on the forwarded ref, so per-frame motion never re-renders React.
 * The whole cluster cross-fades opposite the clone (visible iff a descriptor or a
 * spring dwell is active). It knows nothing of what the action does, only the
 * descriptor / arrow / ring signals and the opaque identity node it is handed.
 *
 * @param props.active - Whether the cluster is visible (the engine's funnel state).
 * @param props.descriptor - The active descriptor, or null.
 * @param props.springKey - The dwell key (restarts the ring on change), or null.
 * @param props.arrow - The direction arrow, or null.
 * @param props.identity - Optional opaque dragged-item node for the right pill.
 * @param ref - Forwarded to the fixed wrapper the engine positions each frame.
 */
export const DragMorphCluster = forwardRef<HTMLDivElement, DragMorphClusterProps>(
   function DragMorphCluster({ active, descriptor, springKey, arrow, identity }, ref) {
      const { t } = useTranslation();

      const glyph = selectMorphGlyph(descriptor, springKey, arrow);
      const GlyphIcon = glyph?.kind === 'arrow' ? (glyph.arrow === 'up' ? ArrowUp : ArrowRight) : descriptor?.Icon ?? null;
      // The action label is no longer shown as text, but it remains the badge's
      // accessible name (tunable, the glyph is the visual, the label the a11y hook).
      const actionLabel = descriptor ? t(descriptor.labelKey) : undefined;

      return (
         <div ref={ref} className="pointer-events-none fixed left-0 top-0 z-[1000]">
            <div className={cn('relative transition-opacity duration-150 ease-in', active ? 'opacity-100' : 'opacity-0')}>
               {/* Dot, centered exactly on the cursor point (the wrapper origin). */}
               <span
                  aria-hidden
                  className="absolute block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md ring-2 ring-background"
               />

               {/* Spring progress ring hugging the dot (~2x its size); keyed off springKey so it restarts per target. */}
               {springKey && (
                  <svg
                     key={springKey}
                     aria-hidden
                     viewBox="0 0 36 36"
                     className="absolute size-6 -translate-x-1/2 -translate-y-1/2 -rotate-90"
                  >
                     <circle cx="18" cy="18" r={RING_RADIUS} fill="none" strokeWidth="2.5" className="stroke-primary/20" />
                     <circle
                        cx="18"
                        cy="18"
                        r={RING_RADIUS}
                        fill="none"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        className="animate-spring-ring stroke-primary"
                     />
                  </svg>
               )}

               {/* Left action badge: one glyph (dwell arrow, else the action icon),
                   translated fully off the dot's left and vertically centered. The
                   18px gap clears the spring ring (radius ~12px) so it never overlaps
                   the loading circle. */}
               {GlyphIcon && (
                  <span
                     role="img"
                     aria-label={actionLabel}
                     style={{ transform: 'translate(calc(-100% - 18px), -50%)' }}
                     className="absolute left-0 top-0 flex size-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background"
                  >
                     <GlyphIcon className="size-3" />
                  </span>
               )}

               {/* Right identity pill: the opaque "what am I dragging" node, offset
                   up-and-to-the-right so it clears the pointer and the content beneath. */}
               {active && identity && (
                  <div aria-hidden style={{ left: '11px', top: '-11px', transform: 'translateY(-100%)' }} className="absolute">
                     {identity}
                  </div>
               )}
            </div>
         </div>
      );
   },
);
