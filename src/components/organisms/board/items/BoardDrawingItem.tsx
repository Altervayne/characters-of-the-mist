// -- Utils Imports --
import { NIB_ANGLE, brushOpacity, buildBrushRibbonPath, buildStrokePath, strokeColorToCss } from '@/lib/board/drawingStyle';

// -- Type Imports --
import type { DrawingBoardContent } from '@/lib/types/board';

/*
 * A drawing LAYER's body: one inert SVG painting the layer's strokes. Points are LAYER-LOCAL (relative
 * to the box origin), so the SVG sits at the box top-left and lets strokes overflow (a stroke can extend
 * past the loose box, including up/left of the origin). Pen and highlighter are smoothed, round-capped,
 * constant-width paths (the connection stroke idiom; the highlighter reads translucent); the brush is a
 * FILLED variable-width calligraphy ribbon. All ink the adaptive foreground or their own picked hex.
 * Inert: the layer is selected/moved via its box chrome, never the strokes.
 */
export function BoardDrawingItem({ content }: { content: DrawingBoardContent }) {
   return (
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
         {content.strokes.map((stroke) =>
            stroke.brush === 'brush' ? (
               <path key={stroke.id} d={buildBrushRibbonPath(stroke.points, stroke.width, NIB_ANGLE)} fill={strokeColorToCss(stroke.color)} stroke="none" />
            ) : (
               <path
                  key={stroke.id}
                  d={buildStrokePath(stroke.points)}
                  fill="none"
                  stroke={strokeColorToCss(stroke.color)}
                  strokeWidth={stroke.width}
                  strokeOpacity={brushOpacity(stroke.brush)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
               />
            ),
         )}
      </svg>
   );
}
