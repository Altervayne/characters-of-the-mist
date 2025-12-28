import { useState, useMemo } from 'react';

export interface ToolbarHoverHandlers {
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

export interface UseToolbarHoverReturn {
  /** Whether the toolbar is currently hovered */
  isHovered: boolean;
  /** Memoized hover event handlers to pass to Framer Motion components */
  hoverHandlers: ToolbarHoverHandlers;
}

/**
 * Hook for managing toolbar hover state with memoized handlers.
 *
 * Eliminates the need for inline arrow functions in component renders,
 * preventing unnecessary re-renders and improving performance.
 *
 * @param isDisabled - Whether hover detection should be disabled (e.g., for drawer preview items)
 * @returns Object containing hover state and memoized event handlers
 *
 * @example
 * ```tsx
 * function MyCard({ isDrawerPreview }) {
 *   const { isHovered, hoverHandlers } = useToolbarHover(isDrawerPreview);
 *
 *   return (
 *     <motion.div {...hoverHandlers}>
 *       <ToolbarHandle isHovered={isHovered} />
 *       <CardContent />
 *     </motion.div>
 *   );
 * }
 * ```
 */
export function useToolbarHover(isDisabled = false): UseToolbarHoverReturn {
  const [isHovered, setIsHovered] = useState(false);

  const hoverHandlers = useMemo<ToolbarHoverHandlers>(() => ({
    onHoverStart: () => !isDisabled && setIsHovered(true),
    onHoverEnd: () => !isDisabled && setIsHovered(false),
  }), [isDisabled]);

  return { isHovered, hoverHandlers };
}
