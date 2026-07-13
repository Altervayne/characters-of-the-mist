// -- Utils Imports --
import { strokePaint } from '@/lib/board/drawingStyle';
import { usePendingErase } from '@/lib/board/PendingEraseContext';
import { useDrawingFocus } from '@/lib/board/DrawingFocusContext';

// -- Type Imports --
import type { StrokePaintInput } from '@/lib/board/drawingStyle';
import type { DrawingBoardContent } from '@/lib/types/board';

/**
 * One stroke as a single `<path>`. All the brush x shape branching lives in {@link strokePaint}, so the
 * drawing item and the live preview paint through the exact same code. Round cap/join stay set for the
 * stroked (pen/highlighter) paths; they are inert on the filled (brush) ribbons.
 */
export function StrokeShape({ stroke }: { stroke: StrokePaintInput }) {
   const paint = strokePaint(stroke);
   return <path d={paint.d} fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.strokeWidth} strokeOpacity={paint.strokeOpacity} strokeLinecap="round" strokeLinejoin="round" />;
}

/*
 * A drawing LAYER's body: one inert SVG painting the layer's strokes. Points are LAYER-LOCAL (relative
 * to the box origin), so the SVG sits at the box top-left and lets strokes overflow (a stroke can extend
 * past the loose box, including up/left of the origin). Pen and highlighter are round-capped stroked paths
 * (smoothed freehand, crisp for shapes); the brush is a FILLED variable-width calligraphy ribbon. All ink
 * the adaptive foreground or their own picked hex. Inert: the layer is selected/moved via its box chrome,
 * never the strokes.
 */
export function BoardDrawingItem({ id, content }: { id: string; content: DrawingBoardContent }) {
   // Strokes the eraser has crossed mid-scrub vanish on contact; the removal only becomes real when the
   // scrub commits. An idle board sees an empty set and skips the filter.
   const hidden = usePendingErase();
   const strokes = hidden.size === 0 ? content.strokes : content.strokes.filter((stroke) => !hidden.has(stroke.id));
   // While a drawing gesture is armed, every OTHER drawing layer dims so the active append target reads
   // full-strength. Off (id null) whenever the cue is inactive, so nothing dims.
   const focusId = useDrawingFocus();
   const dimmed = focusId !== null && focusId !== id;
   return (
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible transition-opacity" width="1" height="1" style={{ opacity: dimmed ? 0.4 : 1 }} aria-hidden>
         {strokes.map((stroke) => (
            <StrokeShape key={stroke.id} stroke={stroke} />
         ))}
      </svg>
   );
}
