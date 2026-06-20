// -- Utils Imports --
import { cn } from '@/lib/utils';

/**
 * Static target highlight for spring-loaded drawer navigation: a light inset ring
 * marking WHICH folder row / Back button the dwell is aimed at. The dwell *progress*
 * lives on the drag-morph cursor ring, so this carries no fill; it only answers
 * "which target?" while the ring answers "how long left?". Render it inside a
 * `relative` row; it is absolutely positioned and `pointer-events-none` so it never
 * affects layout or intercepts the drag.
 *
 * @param props.active - Whether this row/button is the current dwell target.
 */
export function SpringDwellAffordance({ active }: { active: boolean }) {
   if (!active) return null;

   return (
      <span
         aria-hidden
         className={cn('pointer-events-none absolute inset-0 rounded bg-primary/5 ring-2 ring-inset ring-primary/60')}
      />
   );
}
