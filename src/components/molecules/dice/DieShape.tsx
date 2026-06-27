// -- React Imports --
import { useMemo } from 'react';

// -- Utils Imports --
import { projectDieFaceOn } from '@/lib/board/dieGeometry';

// -- Type Imports --
import type { DieSides } from '@/lib/dice/diceTrayTypes';

/*
 * A die drawn as its real polyhedron viewed straight down a front face's normal: the
 * number sits flat and centered on that face, and the depth comes from the neighboring
 * faces receding around it (the projection back-face-culls the rest). A cube shows a clean
 * flat square (its neighbors are edge-on); the polyhedral dice show their facet ring. d100
 * reuses the d10 trapezohedron, told apart by mirroring its shape (the digits never mirror).
 *
 * The shapes all share the same box but don't fill it equally, so a few get a COSMETIC
 * transform (shape only, never the number) to even out their visual weight: the cube shrinks
 * a touch so its full square stops dominating, the lone tetrahedron triangle grows + tilts to
 * carry more, and the d100 mirrors so it can't be mistaken for the d10.
 */

const points = (pts: [number, number][]): string => pts.map(([x, y]) => `${x},${y}`).join(' ');

/** A transform pivoted on (50, cy) - cy defaults to the box center, but the d4 pivots lower (see below). */
const pivot = (ops: string, cy = 50): string => `translate(50 ${cy}) ${ops} translate(-50 -50)`;

/*
 * Cosmetic shape-only transforms to even out visual weight / distinguish the d100. Tuned by eye:
 * - d6: shrink so the full square stops out-weighing the lighter polyhedral shapes.
 * - d4: grow + tilt so the lone triangle carries more. Its apex sits right at the top edge, so a
 *   purely centered scale-up would clip the tip - the lower pivot nudges it down into its own slack.
 * - d100: mirror the d10 trapezohedron (its silhouette is asymmetric, so the flip reads as a clearly
 *   different shape) - the digits never mirror, they live outside this transform.
 */
const SHAPE_TRANSFORM: Partial<Record<DieSides, string>> = {
   4: pivot('scale(1.14) rotate(10)', 57),
   6: pivot('scale(0.9)'),
   100: pivot('scale(-1 1)'),
};

export function DieShape({ sides, value }: { sides: DieSides; value: number | null }) {
   const projection = useMemo(() => projectDieFaceOn(sides), [sides]);
   // Smaller text for a 3-digit (d100 = 100) face so it stays inside the shape.
   const fontSize = value != null && value >= 100 ? 22 : value != null && value >= 10 ? 28 : 34;

   return (
      <svg viewBox="0 0 100 100" className="h-full w-full text-primary">
         {/* Shape (faces / interior / silhouette) under its weight-balancing transform; the number stays
             outside this group, always upright + centered + full-size. */}
         <g transform={SHAPE_TRANSFORM[sides]}>
            {/* Subtle face fills: the front (number) face a touch stronger than the receding neighbors. */}
            {projection.faces.map((face, index) => (
               <polygon key={index} points={points(face.points)} fill="currentColor" fillOpacity={face.front ? 0.16 : 0.07} />
            ))}
            {/* Shared interior edges, lighter. */}
            {projection.interior.map(([a, b], index) => (
               <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeOpacity={0.4} strokeWidth={2} strokeLinecap="round" />
            ))}
            {/* Silhouette outline, heavier. */}
            {projection.silhouette.map(([a, b], index) => (
               <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
            ))}
         </g>
         {value != null && (
            <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize={fontSize} className="fill-foreground font-mono font-bold">
               {value}
            </text>
         )}
      </svg>
   );
}
