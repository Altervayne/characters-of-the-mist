// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Type Imports --
import type { ReactNode } from 'react';



export interface DragWrapperProps {
  isBeingDragged: boolean;
  children: ReactNode;
  /**
   * Drops framer's `layout` projection (see {@link DragLayoutWrapper}). Framer measures in an
   * unscaled space with no notion of an ancestor CSS `zoom`, so under a zoomed sheet its projection
   * fights dnd-kit's zoom-corrected sibling shift and snaps the item back. When set, dnd-kit's own
   * transition carries the reorder instead (as the drawer's static wrapper already does). Zoom is
   * constant across a drag, so this never toggles mid-gesture.
   */
  disableLayout?: boolean;
}



/**
 * Motion wrapper for cards and trackers on the character sheet.
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
export function DragLayoutWrapper({ isBeingDragged, children, disableLayout = false }: DragWrapperProps) {
  // Under zoom, OMIT `layout` entirely rather than passing `layout={false}`: framer's projection isn't
  // zoom-aware and would animate a reflow along an uncorrected path. This mirrors the drawer's static
  // wrapper (no layout projection). The zoomed sheet's sortables also drop their transition, so siblings
  // snap straight to their (correct) rest slot - no travel to mis-track. At 100% `layout` stays on.
  return (
    <motion.div
      {...(disableLayout ? {} : { layout: true })}
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
