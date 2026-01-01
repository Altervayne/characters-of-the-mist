// -- React Imports --
import React from 'react';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

// -- Component Imports --
import { ToolbarHandle } from './toolbar-handle';

// -- Type Imports --
import type { Card as CardData } from '@/lib/types/character';
import type { ToolbarHoverHandlers } from '@/hooks/useToolbarHover';

interface CardFlipWrapperProps {
  effectiveViewMode: 'FLIP' | 'SIDE_BY_SIDE';
  isDrawerPreview: boolean;
  isSnapshot?: boolean;
  card: CardData;

  // Hover
  isHovered: boolean;
  hoverHandlers: ToolbarHoverHandlers;

  // Toolbar
  isEditing: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  cardTheme: string;
  onExport?: () => void;
  onCycleViewMode: () => void;

  // Optional toolbar actions
  onFlip?: () => void;
  onDelete?: () => void;
  onEditCard?: () => void;

  // Content
  cardFront: React.ReactNode;
  cardBack: React.ReactNode;
}

/**
 * Wrapper component that handles card flip and side-by-side view modes.
 *
 * @example
 * ```tsx
 * return (
 *   <CardFlipWrapper
 *     ref={ref}
 *     effectiveViewMode={effectiveViewMode}
 *     isDrawerPreview={isDrawerPreview}
 *     card={card}
 *     isHovered={isHovered}
 *     hoverHandlers={hoverHandlers}
 *     isEditing={isEditing}
 *     cardTheme="card-type-hero"
 *     onFlip={() => actions.flipCard(card.id)}
 *     onCycleViewMode={handleCycleViewMode}
 *     cardFront={<Card>...</Card>}
 *     cardBack={<Card>...</Card>}
 *   />
 * );
 * ```
 */
export const CardFlipWrapper = React.forwardRef<HTMLDivElement, CardFlipWrapperProps>(
  ({ effectiveViewMode, isDrawerPreview, isSnapshot, card, isHovered, hoverHandlers,
     isEditing, dragAttributes, dragListeners, cardTheme, onExport, onCycleViewMode,
     onFlip, onDelete, onEditCard, cardFront, cardBack }, ref) => {

    if (effectiveViewMode === 'SIDE_BY_SIDE' && !isDrawerPreview) {
      return (
        <motion.div ref={ref} {...hoverHandlers} className="relative">
          <ToolbarHandle
            isEditing={isEditing}
            isHovered={isHovered}
            dragAttributes={dragAttributes}
            dragListeners={dragListeners}
            onDelete={onDelete}
            onEditCard={onEditCard}
            onExport={onExport}
            onCycleViewMode={onCycleViewMode}
            cardViewMode={card.viewMode}
            cardTheme={cardTheme}
          />
          <div className="flex gap-1 items-start">
            {cardFront}
            {cardBack}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div ref={ref} {...hoverHandlers} className="relative">
        <motion.div
          className="w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
          initial={isSnapshot ? { rotateY: card.isFlipped ? 180 : 0 } : { rotateY: 0 }}
          animate={{ rotateY: card.isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {!isDrawerPreview && (
            <ToolbarHandle
              isEditing={isEditing}
              isHovered={isHovered}
              onFlip={onFlip}
              onDelete={onDelete}
              onEditCard={onEditCard}
              dragAttributes={dragAttributes}
              dragListeners={dragListeners}
              onExport={onExport}
              onCycleViewMode={onCycleViewMode}
              cardViewMode={card.viewMode}
              cardTheme={cardTheme}
            />
          )}
          <div style={{ backfaceVisibility: 'hidden' }}>
            {cardFront}
          </div>
          <div
            className="absolute top-0 left-0 w-full h-full"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {cardBack}
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

CardFlipWrapper.displayName = 'CardFlipWrapper';
