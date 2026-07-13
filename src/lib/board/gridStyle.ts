// -- Type Imports --
import type { CSSProperties } from 'react';
import type { BoardGrid, Viewport } from '@/lib/types/board';

/*
 * Screen-space CSS backgrounds for the canvas grid layer. Position tracks the pan, size is the
 * adaptive on-screen spacing, and the color falls back to `currentColor` (set subtle on the layer)
 * so the grid reads on both themes. The same builder feeds the grid-menu preview swatches, so the
 * menu can never drift from the canvas. `hex` has no CSS form - it is drawn as a tiling SVG pattern
 * (see `hexGrid`) - and `none` plus any unrecognized value draw nothing.
 */
export function gridBackground(grid: BoardGrid, spacing: number, viewport: Viewport): CSSProperties {
   const color = grid.color ?? 'currentColor';
   const position = `${viewport.x}px ${viewport.y}px`;
   const size = `${spacing}px ${spacing}px`;
   if (grid.type === 'dots') {
      return { backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1.5px)`, backgroundSize: size, backgroundPosition: position };
   }
   if (grid.type === 'lines') {
      return {
         backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
         backgroundSize: size,
         backgroundPosition: position,
      };
   }
   if (grid.type === 'h-lines') {
      return { backgroundImage: `linear-gradient(to bottom, ${color} 1px, transparent 1px)`, backgroundSize: size, backgroundPosition: position };
   }
   if (grid.type === 'v-lines') {
      return { backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px)`, backgroundSize: size, backgroundPosition: position };
   }
   return {};
}
