// -- Utils Imports --
import { buildStrokePath, strokeColorToCss } from '@/lib/board/drawingStyle';

// -- Type Imports --
import type { DrawingBoardContent } from '@/lib/types/board';

/*
 * A drawing LAYER's body: one inert SVG painting the layer's strokes. Points are LAYER-LOCAL (relative
 * to the box origin), so the SVG sits at the box top-left and lets strokes overflow (a stroke can extend
 * past the loose box, including up/left of the origin). Each stroke is a smoothed, round-capped path -
 * the connection stroke idiom - inking the adaptive foreground or its own picked hex. Inert: the layer is
 * selected/moved via its box chrome, never the strokes.
 */
export function BoardDrawingItem({ content }: { content: DrawingBoardContent }) {
   return (
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
         {content.strokes.map((stroke) => (
            <path
               key={stroke.id}
               d={buildStrokePath(stroke.points)}
               fill="none"
               stroke={strokeColorToCss(stroke.color)}
               strokeWidth={stroke.width}
               strokeLinecap="round"
               strokeLinejoin="round"
            />
         ))}
      </svg>
   );
}
