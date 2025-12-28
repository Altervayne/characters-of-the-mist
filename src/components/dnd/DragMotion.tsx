// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Type Imports --
import type { ReactNode } from 'react';



export interface DragWrapperProps {
  /** Whether this item is currently being dragged */
  isBeingDragged: boolean;
  /** The content to wrap */
  children: ReactNode;
}



/**
 * Motion wrapper for cards and trackers on the character sheet.
 *
 * Uses Framer Motion's `layout` animation (without "position") to handle
 * reordering animations safely alongside dnd-kit's transforms.
 *
 * **Important**: This wrapper is safe to use with dnd-kit because it uses
 * `layout` (not `layout="position"`), which doesn't conflict with CSS transforms.
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
export function DragLayoutWrapper({ isBeingDragged, children }: DragWrapperProps) {
  return (
    <motion.div
      layout
      animate={{ opacity: isBeingDragged ? 0.4 : 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for drawer items (folders and items).
 *
 * Uses a simple opacity animation WITHOUT layout animations to avoid
 * conflicts with dnd-kit's positioning system.
 *
 * **Important**: This wrapper does NOT use `layout` or `layout="position"` to
 * prevent freezing during drag operations.
 *
 * @example
 * ```tsx
 * <Sortable id={item.id} data={{ type: 'drawer-item', item }}>
 *   {({ dragAttributes, dragListeners, isBeingDragged }) => (
 *     <DragStaticWrapper isBeingDragged={isBeingDragged}>
 *       <DrawerItemPreview item={item} />
 *     </DragStaticWrapper>
 *   )}
 * </Sortable>
 * ```
 */
export function DragStaticWrapper({ isBeingDragged, children }: DragWrapperProps) {
  return (
    <motion.div
      animate={{ opacity: isBeingDragged ? 0.5 : 1 }}
      transition={{ duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}
