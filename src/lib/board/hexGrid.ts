/*
 * Pure geometry for the board's hexagonal grid. The hive is painted as a tiling SVG `<pattern>`;
 * this builds the tile's repeat size and the outline path for a pointy-top honeycomb so the canvas
 * stays free of the trigonometry. Kept pure and unit-tested, like the world<->screen math in
 * `boardCoordinates`.
 */

const SQRT3 = Math.sqrt(3);

/** A honeycomb pattern tile: its repeat size and an outline path that tiles seamlessly. */
export interface HexTile {
   width: number;
   height: number;
   /** An SVG path (`d`) of the hex outlines; repeating it at `width` x `height` fills the plane. */
   path: string;
}

/** Trims to 3 decimals so the emitted path stays compact and stable across renders. */
function round(value: number): number {
   return Math.round(value * 1000) / 1000;
}

/** The six vertices of a pointy-top hexagon of circumradius `r` centered at `(cx, cy)`. */
function hexVertices(cx: number, cy: number, r: number): [number, number][] {
   const half = (SQRT3 * r) / 2;
   return [
      [cx, cy - r],
      [cx + half, cy - r / 2],
      [cx + half, cy + r / 2],
      [cx, cy + r],
      [cx - half, cy + r / 2],
      [cx - half, cy - r / 2],
   ];
}

/** Formats a closed polygon from its vertices as an SVG path fragment. */
function polygonPath(points: [number, number][]): string {
   return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join('') + 'Z';
}

/**
 * Builds the honeycomb tile for a hex of circumradius `size`. The fundamental domain is a
 * `√3·size` x `3·size` rectangle holding two hexagons - one centered, one on the corner - which
 * share an edge and continue seamlessly into the neighbouring tiles when the pattern repeats.
 */
export function hexTile(size: number): HexTile {
   const width = SQRT3 * size;
   const height = 3 * size;
   const centered = polygonPath(hexVertices(width / 2, height / 2, size));
   const corner = polygonPath(hexVertices(0, 0, size));
   return { width, height, path: `${centered} ${corner}` };
}
