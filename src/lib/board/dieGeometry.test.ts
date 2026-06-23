// -- Library Imports --
import { describe, expect, it } from 'vitest';

// -- Local Imports --
import { projectDieFaceOn } from './dieGeometry';

/*
 * Tests for the face-on die projection. The key invariant: a neighbor face shows only when
 * the solid's dihedral exceeds 90 deg, so a cube (90) reveals none (a flat square) while the
 * polyhedral dice reveal their facet ring.
 */

const neighbors = (sides: number) => projectDieFaceOn(sides).faces.filter((face) => !face.front);
const frontFace = (sides: number) => projectDieFaceOn(sides).faces.find((face) => face.front);

describe('projectDieFaceOn', () => {
   it('cube: a flat square front face with NO visible neighbors (dihedral exactly 90)', () => {
      const projection = projectDieFaceOn(6);
      expect(neighbors(6)).toHaveLength(0);
      expect(frontFace(6)!.points).toHaveLength(4); // a square
      expect(projection.silhouette).toHaveLength(4); // the square's 4 outline edges
   });

   it('octahedron: a triangular front face with 3 visible neighbors', () => {
      expect(frontFace(8)!.points).toHaveLength(3);
      expect(neighbors(8)).toHaveLength(3);
   });

   it('tetrahedron: only the front triangle shows (the back faces lean away)', () => {
      expect(frontFace(4)!.points).toHaveLength(3);
      expect(neighbors(4)).toHaveLength(0);
   });

   it('dodecahedron: a pentagon front face ringed by its 5 neighbors', () => {
      expect(frontFace(12)!.points).toHaveLength(5);
      expect(neighbors(12)).toHaveLength(5);
   });

   it('icosahedron: a triangular front face with a visible facet ring', () => {
      expect(frontFace(20)!.points).toHaveLength(3);
      expect(neighbors(20).length).toBeGreaterThanOrEqual(3);
   });

   it('d100 reuses the d10 trapezohedron (a 4-sided kite front face)', () => {
      expect(frontFace(100)!.points).toHaveLength(4);
      expect(frontFace(10)!.points).toHaveLength(4);
   });

   it('every projected coordinate stays within the 0..100 box', () => {
      for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
         for (const face of projectDieFaceOn(sides).faces) {
            for (const [x, y] of face.points) {
               expect(x).toBeGreaterThanOrEqual(0);
               expect(x).toBeLessThanOrEqual(100);
               expect(y).toBeGreaterThanOrEqual(0);
               expect(y).toBeLessThanOrEqual(100);
            }
         }
      }
   });
});
