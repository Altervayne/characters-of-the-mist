// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { InsertPosition } from '@/lib/utils/dragFeedback';


/**
 * A single, absolutely-positioned reorder insertion line (tabs polish-18). It marks
 * exactly where a dragged row/card will land WITHOUT affecting layout (so spacing stays
 * constant during a drag), replacing the old expanding-gap indicator. Render it inside a
 * `relative` wrapper around the hovered row/card.
 *
 * - `horizontal` (vertical lists, e.g. drawer items): a full-width 2px line at the row's
 *   top (`before`) or bottom (`after`) edge.
 * - `vertical` (wrapping card/tracker grids): a full-height 2px line at the card's left
 *   (`before`) or right (`after`) edge.
 *
 * @param props.orientation - Line orientation: `horizontal` for lists, `vertical` for grids.
 * @param props.position - Whether the item lands `before` or `after` the wrapped element.
 */
export function DropInsertionLine({ orientation, position }: { orientation: 'horizontal' | 'vertical'; position: InsertPosition }) {
   const base = 'pointer-events-none absolute z-10 bg-primary rounded-full';
   const className = orientation === 'horizontal'
      ? cn(base, 'left-0 right-0 h-0.5', position === 'before' ? '-top-1' : '-bottom-1')
      : cn(base, 'top-0 bottom-0 w-0.5', position === 'before' ? '-left-2' : '-right-2');
   return <div aria-hidden className={className} />;
}
