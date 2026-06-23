// -- React Imports --
import { useMemo } from 'react';

// -- Utils Imports --
import { projectDieFaceOn } from '@/lib/board/dieGeometry';

// -- Type Imports --
import type { DieSides } from '@/lib/types/board';

/*
 * A die drawn as its real polyhedron viewed straight down a front face's normal: the
 * number sits flat and centered on that face, and the depth comes from the neighboring
 * faces receding around it (the projection back-face-culls the rest). A cube shows a clean
 * flat square (its neighbors are edge-on); the polyhedral dice show their facet ring. d100
 * reuses the d10 trapezohedron with a "%" mark. An unrolled die shows the bare solid.
 */

const points = (pts: [number, number][]): string => pts.map(([x, y]) => `${x},${y}`).join(' ');

export function DieShape({ sides, value }: { sides: DieSides; value: number | null }) {
   const projection = useMemo(() => projectDieFaceOn(sides), [sides]);
   // Smaller text for a 3-digit (d100 = 100) face so it stays inside the shape.
   const fontSize = value != null && value >= 100 ? 22 : value != null && value >= 10 ? 28 : 34;

   return (
      <svg viewBox="0 0 100 100" className="h-full w-full text-primary">
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
         {value != null && (
            <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize={fontSize} className="fill-foreground font-mono font-bold">
               {value}
            </text>
         )}
         {sides === 100 && (
            <text x="78" y="30" textAnchor="middle" dominantBaseline="central" fontSize={18} className="fill-muted-foreground font-bold">
               %
            </text>
         )}
      </svg>
   );
}
