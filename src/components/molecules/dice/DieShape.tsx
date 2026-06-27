// -- React Imports --
import { useMemo } from 'react';

// -- Utils Imports --
import { cn } from '@/lib/utils';
import { projectDieFaceOn } from '@/lib/board/dieGeometry';

/*
 * A die drawn by its side count. The seven platonic dice are drawn as their real polyhedron viewed straight
 * down a front face's normal (the number sits flat and centered; depth comes from the neighboring faces
 * receding around it), with d100 the mirrored d10. A d2 is a coin (a circle). Any OTHER side count (a d3, a
 * d63, ...) shares ONE generic faceted "weird die" silhouette, told apart by a `dN` badge rather than a
 * real projection - `projectDieFaceOn` only knows the seven platonic solids, so a non-platonic side count
 * must never reach it. A negative (penalty) die renders in the destructive palette so it reads at a glance.
 */

const PLATONIC = new Set([4, 6, 8, 10, 12, 20, 100]);

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
const SHAPE_TRANSFORM: Record<number, string> = {
   4: pivot('scale(1.14) rotate(10)', 57),
   6: pivot('scale(0.9)'),
   100: pivot('scale(-1 1)'),
};

/** Font size for the centered value: smaller as the digit count grows so it stays inside the shape. */
const valueFontSize = (value: number): number => (value >= 100 ? 22 : value >= 10 ? 28 : 34);

export function DieShape({ sides, value, negative = false }: { sides: number; value: number | null; negative?: boolean }) {
   // A negative die paints in the destructive palette; otherwise the primary one. Each branch is its own
   // component so its hooks stay unconditional (a die's `sides` never changes in place - the picker adds a
   // fresh die - so the branch is stable per instance anyway).
   const colorClass = negative ? 'text-destructive' : 'text-primary';
   if (sides === 2) return <CoinShape value={value} colorClass={colorClass} />;
   if (!PLATONIC.has(sides)) return <WeirdDieShape sides={sides} value={value} colorClass={colorClass} />;
   return <PolyhedronShape sides={sides} value={value} colorClass={colorClass} />;
}

/** The centered rolled value, drawn outside any shape transform so it is never scaled / rotated / mirrored. */
function ValueText({ value }: { value: number }) {
   return (
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize={valueFontSize(value)} className="fill-foreground font-mono font-bold">
         {value}
      </text>
   );
}

/** A platonic die: the real polyhedron projected face-on, with its facet ring legible at tray size. */
function PolyhedronShape({ sides, value, colorClass }: { sides: number; value: number | null; colorClass: string }) {
   const projection = useMemo(() => projectDieFaceOn(sides), [sides]);
   return (
      <svg viewBox="0 0 100 100" className={cn('h-full w-full', colorClass)}>
         {/* Shape (faces / interior / silhouette) under its weight-balancing transform; the number stays
             outside this group, always upright + centered + full-size. */}
         <g transform={SHAPE_TRANSFORM[sides]}>
            {/* Subtle face fills: the front (number) face a touch stronger than the receding neighbors. */}
            {projection.faces.map((face, index) => (
               <polygon key={index} points={points(face.points)} fill="currentColor" fillOpacity={face.front ? 0.16 : 0.1} />
            ))}
            {/* Shared interior facet edges - strong enough that the facet count reads (a d8 vs a d20). */}
            {projection.interior.map(([a, b], index) => (
               <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" />
            ))}
            {/* Silhouette outline, heavier. */}
            {projection.silhouette.map(([a, b], index) => (
               <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
            ))}
         </g>
         {value != null && <ValueText value={value} />}
      </svg>
   );
}

/** A d2: a coin (circle) with a subtle inner ring; the value (1 / 2) sits centered. */
function CoinShape({ value, colorClass }: { value: number | null; colorClass: string }) {
   return (
      <svg viewBox="0 0 100 100" className={cn('h-full w-full', colorClass)}>
         <circle cx="50" cy="50" r="42" fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeWidth={5} />
         <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={2.5} />
         {value != null && <ValueText value={value} />}
      </svg>
   );
}

/** A hexagon's vertices (pointy-top), inset to radius `r` around the box center. */
const hexPoints = (r: number): [number, number][] =>
   [-90, -30, 30, 90, 150, 210].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
   });

const WEIRD_OUTER = hexPoints(42);
const WEIRD_INNER = hexPoints(28);

/**
 * The generic "weird die" for any non-platonic side count: one faceted hexagonal gem (outer silhouette + an
 * inset facet ring + connecting edges, in the same line-art style), the rolled value centered, and a `dN`
 * badge so it stays identifiable. The badge shows even when unrolled (it is the only thing telling a d63
 * from a d7).
 */
function WeirdDieShape({ sides, value, colorClass }: { sides: number; value: number | null; colorClass: string }) {
   return (
      <svg viewBox="0 0 100 100" className={cn('h-full w-full', colorClass)}>
         <polygon points={points(WEIRD_OUTER)} fill="currentColor" fillOpacity={0.1} />
         <polygon points={points(WEIRD_INNER)} fill="currentColor" fillOpacity={0.06} />
         {/* Facet ring + the spokes joining it to the silhouette, matching the polyhedral interior weight. */}
         {WEIRD_INNER.map((p, i) => {
            const next = WEIRD_INNER[(i + 1) % WEIRD_INNER.length];
            return <line key={`r${i}`} x1={p[0]} y1={p[1]} x2={next[0]} y2={next[1]} stroke="currentColor" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" />;
         })}
         {WEIRD_INNER.map((p, i) => (
            <line key={`s${i}`} x1={p[0]} y1={p[1]} x2={WEIRD_OUTER[i][0]} y2={WEIRD_OUTER[i][1]} stroke="currentColor" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" />
         ))}
         {/* Silhouette outline, heavier. */}
         {WEIRD_OUTER.map((p, i) => {
            const next = WEIRD_OUTER[(i + 1) % WEIRD_OUTER.length];
            return <line key={`o${i}`} x1={p[0]} y1={p[1]} x2={next[0]} y2={next[1]} stroke="currentColor" strokeWidth={5} strokeLinecap="round" />;
         })}
         {value != null && <ValueText value={value} />}
         {/* Side-count badge: small + muted so it identifies the die without competing with the value. */}
         <text x="50" y="90" textAnchor="middle" dominantBaseline="central" fontSize={15} className="fill-muted-foreground font-mono font-semibold">
            d{sides}
         </text>
      </svg>
   );
}
