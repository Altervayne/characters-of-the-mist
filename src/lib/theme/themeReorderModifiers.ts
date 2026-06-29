// -- Type Imports --
import type { Modifier } from '@dnd-kit/core';

/*
 * Drag modifiers for the custom-theme reorder list. The `@dnd-kit/modifiers` package isn't a dependency, so
 * these are inlined (vertical-axis matches the existing mobile-list convention; the parent bound mirrors
 * `restrictToParentElement`). Together they keep a row sliding straight up and down within the list's box -
 * no horizontal drift, and no dragging past the ends to grow the scroller.
 */

/** Locks a drag to the Y axis (kills horizontal drift on a row drag). */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Clamps the dragged row to its parent (the list) so it can't be pulled past the top or bottom - a
 * transformed row dragged below would otherwise overflow the `overflow-y-auto` container and expand it.
 */
export const restrictToParentElement: Modifier = ({ containerNodeRect, draggingNodeRect, transform }) => {
   if (!draggingNodeRect || !containerNodeRect) return transform;
   const value = { ...transform };
   if (draggingNodeRect.top + transform.y <= containerNodeRect.top) {
      value.y = containerNodeRect.top - draggingNodeRect.top;
   } else if (draggingNodeRect.bottom + transform.y >= containerNodeRect.top + containerNodeRect.height) {
      value.y = containerNodeRect.top + containerNodeRect.height - draggingNodeRect.bottom;
   }
   return value;
};
