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
export function Sortable({ id, data, disabled = false, children }: SortableProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
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
