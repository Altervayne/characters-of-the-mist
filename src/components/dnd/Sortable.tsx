// -- Other Library Imports --
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// -- Type Imports --
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { DragData } from '@/lib/types/common';



/**
 * Props passed to the render function of Sortable component
 */
export interface SortableChildProps {
  /** Accessibility attributes for the draggable element */
  dragAttributes?: DraggableAttributes;
  /** Event listeners for drag interactions */
  dragListeners?: SyntheticListenerMap;
  /** Whether this item is currently being dragged */
  isDragging: boolean;
  /** Alias for isDragging for backward compatibility */
  isBeingDragged: boolean;
}



/**
 * Props for the Sortable component
 */
export interface SortableProps {
  /** Unique identifier for the sortable item */
  id: string;
  /** Data associated with the draggable item */
  data: DragData;
  /** Whether dragging is disabled */
  disabled?: boolean;
  /**
   * Divisor for the sibling-shift translate, for a Sortable rendered inside a CSS-`zoom`ed
   * container (e.g. the zoomed character sheet). dnd-kit measures the shift from `getBoundingClientRect`
   * deltas, already in zoomed px, and the container re-scales the translate again on render - so the gap
   * overshoots by the zoom factor. Pre-dividing by the container's zoom cancels it. Default 1 leaves the
   * transform byte-identical, so every unzoomed usage is untouched.
   */
  scale?: number;
  /** Render function that receives drag props */
  children: (props: SortableChildProps) => React.ReactNode;
}

/**
 * Reusable sortable wrapper component that encapsulates dnd-kit's useSortable logic.
 *
 * Uses the render props pattern to provide maximum flexibility while maintaining
 * a single source of truth for drag-and-drop behavior.
 *
 * @example
 * ```tsx
 * <Sortable id={card.id} data={{ type: 'sheet-card', item: card }}>
 *   {({ dragAttributes, dragListeners, isBeingDragged }) => (
 *     <DragLayoutWrapper isBeingDragged={isBeingDragged}>
 *       <CardRenderer dragAttributes={dragAttributes} dragListeners={dragListeners} />
 *     </DragLayoutWrapper>
 *   )}
 * </Sortable>
 * ```
 */
export function Sortable({ id, data, disabled = false, scale = 1, children }: SortableProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
  });

  // Divide the shift by the container zoom before rendering, so the gap lands accurately in a zoomed
  // sheet. Same reference (and byte-identical output) when scale is 1, so unzoomed usages don't change.
  const shift = transform && scale !== 1 ? { ...transform, x: transform.x / scale, y: transform.y / scale } : transform;

  const style = {
    transform: CSS.Translate.toString(shift),
    // Under zoom, snap siblings straight to their (correct) shifted slot with no transition: an
    // animated travel plays along an uncorrected path and only settles right at rest. The rest
    // positions are already accurate, so an instant gap beats an overshooting slide. Unzoomed keeps
    // the smooth transition.
    transition: scale !== 1 ? undefined : transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragAttributes: attributes,
        dragListeners: listeners,
        isDragging,
        isBeingDragged: isDragging,
      })}
    </div>
  );
}
