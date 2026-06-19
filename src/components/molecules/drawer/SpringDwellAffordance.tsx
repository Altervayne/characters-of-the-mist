// -- Utils Imports --
import { cn } from '@/lib/utils';

/**
 * Progress affordance for spring-loaded drawer navigation (tabs polish-7): an inset
 * ring marking the dwell target plus a bottom bar that fills over the dwell window,
 * telling the user the spring is building. Render it inside a `relative` row; it is
 * absolutely positioned and `pointer-events-none` so it never affects layout or
 * intercepts the drag.
 *
 * The host must remount this on every target change (e.g. key it off the row, which
 * React already does) so the CSS fill animation restarts from zero. The fill
 * duration lives in the `spring-fill` keyframe in `global.css` and MUST match
 * `SPRING_HOLD_MS`.
 *
 * @param props.active - Whether this row/button is the current dwell target.
 */
export function SpringDwellAffordance({ active }: { active: boolean }) {
   if (!active) return null;

   return (
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden rounded ring-2 ring-inset ring-primary')}>
         <span className="absolute bottom-0 left-0 h-0.5 bg-primary animate-spring-fill" />
      </span>
   );
}
