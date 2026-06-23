/*
 * Real polyhedra for the dice, projected face-on: each die is viewed straight down one
 * face's normal, so that "front" face is flat in the picture plane (its number reads
 * undistorted) and the 3D look comes only from the neighboring faces that lean toward the
 * viewer. A neighbor is visible exactly when it tilts forward - i.e. the solid's dihedral
 * angle exceeds 90 deg - so a cube (dihedral 90) honestly shows a flat square, while the
 * polyhedral dice show their facet ring. Same back-face rule, no special-casing.
 *
 * The dodecahedron and the d10 trapezohedron are built as duals (of the icosahedron and a
 * pentagonal antiprism), so their face topology is derived, never hand-listed.
 */

export type Vec3 = [number, number, number];
type Polyhedron = { vertices: Vec3[]; faces: number[][] };

// ==================
//  Vector helpers
// ==================
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: Vec3): Vec3 => { const l = length(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centroid = (points: Vec3[]): Vec3 => {
   const sum = points.reduce<Vec3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
   return scale(sum, 1 / points.length);
};

/** The face's outward unit normal (flipped to point away from the solid's center at the origin). */
function faceNormal(poly: Polyhedron, face: number[]): Vec3 {
   const [a, b, c] = [poly.vertices[face[0]], poly.vertices[face[1]], poly.vertices[face[2]]];
   let normal = normalize(cross(sub(b, a), sub(c, a)));
   if (dot(normal, centroid(face.map((i) => poly.vertices[i]))) < 0) normal = scale(normal, -1);
   return normal;
}

// ==================
//  Polyhedra
// ==================
const PHI = (1 + Math.sqrt(5)) / 2;

const TETRAHEDRON: Polyhedron = {
   vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
   faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]],
};

const CUBE: Polyhedron = {
   vertices: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
   faces: [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]],
};

const OCTAHEDRON: Polyhedron = {
   vertices: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
   faces: [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [0, 2, 5], [2, 1, 5], [1, 3, 5], [3, 0, 5]],
};

const ICOSAHEDRON: Polyhedron = {
   vertices: [
      [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
      [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
      [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
   ],
   faces: [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
   ],
};

/** A pentagonal antiprism (its dual is the d10 trapezohedron). */
function pentagonalAntiprism(): Polyhedron {
   const vertices: Vec3[] = [];
   const top: number[] = [];
   const bottom: number[] = [];
   for (let i = 0; i < 5; i++) { const a = (2 * Math.PI * i) / 5; top.push(vertices.length); vertices.push([Math.cos(a), Math.sin(a), 0.62]); }
   for (let i = 0; i < 5; i++) { const a = (2 * Math.PI * i) / 5 + Math.PI / 5; bottom.push(vertices.length); vertices.push([Math.cos(a), Math.sin(a), -0.62]); }
   const faces: number[][] = [top.slice(), bottom.slice().reverse()];
   for (let i = 0; i < 5; i++) {
      faces.push([top[i], bottom[i], top[(i + 1) % 5]]);
      faces.push([bottom[i], bottom[(i + 1) % 5], top[(i + 1) % 5]]);
   }
   return { vertices, faces };
}

/**
 * The dual polyhedron: a vertex per original face (its centroid) and a face per original
 * vertex (its incident faces, ordered around the vertex). Used to derive the dodecahedron
 * (dual of the icosahedron) and the d10 trapezohedron (dual of a pentagonal antiprism)
 * without hand-listing their faces.
 */
function dual(poly: Polyhedron): Polyhedron {
   const vertices = poly.faces.map((face) => centroid(face.map((i) => poly.vertices[i])));
   const faces = poly.vertices.map((vertex, vi) => {
      const incident = poly.faces.map((face, fi) => ({ fi, face })).filter((x) => x.face.includes(vi));
      // Order the incident faces by angle around the vertex direction so the dual face is a
      // simple (non-self-crossing) polygon.
      const axis = normalize(vertex);
      const ref: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const tx = normalize(cross(axis, ref));
      const ty = cross(axis, tx);
      incident.sort((a, b) => Math.atan2(dot(vertices[a.fi], ty), dot(vertices[a.fi], tx)) - Math.atan2(dot(vertices[b.fi], ty), dot(vertices[b.fi], tx)));
      return incident.map((x) => x.fi);
   });
   return { vertices, faces };
}

const DODECAHEDRON = dual(ICOSAHEDRON);
const TRAPEZOHEDRON = dual(pentagonalAntiprism());

const POLYHEDRA: Record<number, Polyhedron> = {
   4: TETRAHEDRON,
   6: CUBE,
   8: OCTAHEDRON,
   10: TRAPEZOHEDRON,
   12: DODECAHEDRON,
   20: ICOSAHEDRON,
   100: TRAPEZOHEDRON,
};

// ==================
//  Face-on projection
// ==================

type Point = [number, number];

export interface DieProjection {
   /** Visible faces, projected; `front` is the flat number-bearing face. */
   faces: { points: Point[]; front: boolean }[];
   /** Outline edges (a visible face on only one side), stroked heavier. */
   silhouette: [Point, Point][];
   /** Shared edges between two visible faces, stroked lighter. */
   interior: [Point, Point][];
}

/**
 * Projects `sides` viewed straight down face `frontFace`'s normal, into a 0..100 box
 * centered on that face (so the number sits flat at the center). Returns only the visible
 * faces (front-facing after the rotation) and their edges split into silhouette vs interior.
 */
export function projectDieFaceOn(sides: number, frontFace = 0): DieProjection {
   const poly = POLYHEDRA[sides];
   const normals = poly.faces.map((face) => faceNormal(poly, face));
   const zAxis = normals[frontFace];

   // View basis: zAxis toward the viewer, xAxis along the front face's first edge (so e.g. a
   // cube face lands axis-aligned, not as a diamond).
   const front = poly.faces[frontFace];
   const edge = sub(poly.vertices[front[1]], poly.vertices[front[0]]);
   const xAxis = normalize(sub(edge, scale(zAxis, dot(edge, zAxis))));
   const yAxis = cross(zAxis, xAxis);
   const project = (v: Vec3): Point => [dot(v, xAxis), dot(v, yAxis)];

   // A face is visible when its normal leans toward the viewer (dihedral > 90 -> neighbor shows).
   const EPS = 1e-6;
   const visible = poly.faces.map((face, i) => ({ face, i })).filter((x) => dot(normals[x.i], zAxis) > EPS);

   // Center on the front face's projected centroid; scale so every visible point fits the box.
   const fc = project(centroid(front.map((i) => poly.vertices[i])));
   let half = 0;
   for (const { face } of visible) for (const vi of face) { const p = project(poly.vertices[vi]); half = Math.max(half, Math.abs(p[0] - fc[0]), Math.abs(p[1] - fc[1])); }
   const PAD = 8;
   const s = half > 0 ? (50 - PAD) / half : 1;
   const map = (v: Vec3): Point => { const p = project(v); return [50 + (p[0] - fc[0]) * s, 50 - (p[1] - fc[1]) * s]; };

   const faces = visible.map(({ face, i }) => ({ points: face.map((vi) => map(poly.vertices[vi])), front: i === frontFace }));

   // Count each edge across visible faces: once -> silhouette, twice -> shared interior edge.
   const edges = new Map<string, { a: Point; b: Point; count: number }>();
   for (const { face } of visible) {
      for (let k = 0; k < face.length; k++) {
         const v1 = face[k];
         const v2 = face[(k + 1) % face.length];
         const key = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
         const existing = edges.get(key);
         if (existing) existing.count++;
         else edges.set(key, { a: map(poly.vertices[v1]), b: map(poly.vertices[v2]), count: 1 });
      }
   }
   const silhouette: [Point, Point][] = [];
   const interior: [Point, Point][] = [];
   for (const { a, b, count } of edges.values()) (count === 1 ? silhouette : interior).push([a, b]);

   return { faces, silhouette, interior };
}
