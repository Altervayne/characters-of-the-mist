// -- React Imports --
import type { ReactNode } from 'react';

/** Props for {@link DragMorphClone}. */
interface DragMorphCloneProps {
   /** The drag preview to wrap (the card/tracker/tab snapshot). */
   children: ReactNode;
   /** When true the clone collapses toward the grab point (an actionable morph is showing). */
   funneling: boolean;
   /** Grab point as transform-origin percentages, or null (falls back to center). */
   origin: { x: number; y: number } | null;
}

/**
 * The funneling clone: the drag preview that lives INSIDE @dnd-kit's `<DragOverlay>`.
 * When a morph is active it shrinks toward the captured grab point and fades out,
 * cross-fading with the cursor cluster; off-target it shows the preview at full size.
 *
 * It owns no state — the engine ({@link import('./useDragMorph').useDragMorph})
 * feeds `funneling` + `origin`. Scale/opacity are inline (driven by `funneling`) so
 * the transition is GPU-cheap; left to the overlay's own transform for following the
 * cursor.
 *
 * @param props - The preview, the funnel flag, and the grab-point origin.
 */
export function DragMorphClone({ children, funneling, origin }: DragMorphCloneProps) {
   return (
      <div
         className="transition-[transform,opacity] duration-150 ease-out"
         style={{
            transformOrigin: origin ? `${origin.x}% ${origin.y}%` : 'center',
            transform: funneling ? 'scale(0.05)' : 'scale(1)',
            opacity: funneling ? 0 : 1,
         }}
      >
         {children}
      </div>
   );
}
