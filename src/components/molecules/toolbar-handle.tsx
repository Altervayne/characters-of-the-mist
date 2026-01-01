// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion, AnimatePresence } from 'framer-motion';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// -- Icon Imports --
import { Trash2, GripVertical, RefreshCw, Edit2, Upload, Globe, FlipHorizontal, BookOpen, GripHorizontal, BookPlus, BookMinus, ThumbsDown, ThumbsUp } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Type Imports --
import type { Variants } from 'framer-motion';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { CardViewMode } from '@/lib/types/character';



interface ToolbarHandleProps {
   isEditing: boolean;
   isHovered: boolean;
   cardTheme: string;
   onDelete?: () => void;
   onFlip?: () => void;
   onEditCard?: () => void;
   onExport?: () => void;
   onCycleViewMode?: () => void;
   onStoryTagNegative?: () => void;
   onUpgradeStoryTag?: () => void;
   onDowngradeStoryTheme?: () => void;
   isStoryTagNegative?: boolean;
   cardViewMode?: CardViewMode | null;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   side?: "left" | "right" | "top" | "bottom";
};

interface sideVariants {
   left: Variants,
   right: Variants,
   top: Variants,
   bottom: Variants
};

const variants: sideVariants = {
   left: {
      initial: { opacity: 0, x: 38 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 38 },
   },
   right: {
      initial: { opacity: 0, x: -38 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -38 },
   },
   top: {
      initial: { opacity: 0, y: 38 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 38 },
   },
   bottom: {
      initial: { opacity: 0, y: -38 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -38 },
   },
};



const ViewModeIcon = ({ mode }: { mode: CardViewMode | null | undefined }) => {
   if (mode === 'SIDE_BY_SIDE') return <BookOpen className="h-4 w-4" />;
   if (mode === 'FLIP') return <FlipHorizontal className="h-4 w-4" />;
   return <Globe className="h-4 w-4" />;
};

const ViewModeTooltip = ({ mode }: { mode: CardViewMode | null | undefined }) => {
   const { t: t } = useTranslation();

   if (mode === 'SIDE_BY_SIDE') return <p>{t('Tooltips.ViewMode.SideBySide')}</p>;
   if (mode === 'FLIP') return <p>{t('Tooltips.ViewMode.Flipping')}</p>;
   return <p>{t('Tooltips.ViewMode.Global')}</p>;
};



export function ToolbarHandle({ isEditing, isHovered, cardTheme, onDelete,
                              onFlip, onEditCard, onExport, onCycleViewMode,
                              onStoryTagNegative, onUpgradeStoryTag, onDowngradeStoryTheme,
                              isStoryTagNegative, cardViewMode, dragAttributes, dragListeners, side = "left" }: ToolbarHandleProps) {
   return (
      <AnimatePresence>
         {isHovered && (
            <motion.div
               variants={variants[side]}
               initial="initial"
               animate="animate"
               exit="exit"
               transition={{ duration: 0.2, ease: "easeInOut" }}
               className={cn(
                  "z-0",
                  "absolute flex items-center justify-center",
                  (side === 'left' || side === 'right') && "top-0 h-full flex-col",
                  (side === 'top' || side === 'bottom') && "left-1/2 -translate-x-1/2 w-auto flex-row",
                  side === 'left' && "-left-9.5",
                  side === 'right' && "-right-9.5",
                  side === 'top' && "-top-9.5",
                  side === 'bottom' && "-bottom-9.5",
                  cardTheme
               )}
            >
               <div className={cn(
                  "relative z-0 p-1 flex items-center bg-red",
                  (side === 'left' || side === 'right') ? "flex-col gap-4 border-y-2" : "flex-row gap-4 border-x-2",
                  side === 'left' && "border-l-2 rounded-l-lg",
                  side === 'right' && "border-r-2 rounded-r-lg",
                  side === 'top' && "border-t-2 rounded-t-lg",
                  side === 'bottom' && "border-b-2 rounded-b-lg",
                  "bg-card-popover-bg border-card-border"
               )}>
                  { onFlip && (
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                        onClick={onFlip}
                     >
                        <RefreshCw className="h-4 w-4" />
                     </Button>
                  )}

                  { isEditing && onEditCard && (
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                        onClick={onEditCard}
                     >
                        <Edit2 className="h-4 w-4" />
                     </Button>
                  )}

                  { onExport && (
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                        onClick={onExport}
                     >
                        <Upload className="h-4 w-4" />
                     </Button>
                  )}

                  <div className="flex items-center justify-center cursor-grab text-card-popover-fg h-7 w-7" {...dragAttributes} {...dragListeners}>
                     { side === "left" || side === "right" ? <GripVertical /> : <GripHorizontal /> }
                  </div>

                  { onStoryTagNegative && (
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                        onClick={onStoryTagNegative}
                     >
                        {
                           isStoryTagNegative ? <ThumbsDown className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />
                        }
                     </Button>
                  )}

                  { onUpgradeStoryTag && (
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                        onClick={onUpgradeStoryTag}
                     >
                        <BookPlus className="h-4 w-4"/>
                     </Button>
                  )}

                  { onDowngradeStoryTheme && (
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                        onClick={onDowngradeStoryTheme}
                     >
                        <BookMinus className="h-4 w-4"/>
                     </Button>
                  )}

                  { onCycleViewMode && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 cursor-pointer bg-card-paper-bg text-card-paper-fg"
                              onClick={onCycleViewMode}
                           >
                              <ViewModeIcon mode={cardViewMode} />
                           </Button>
                        </TooltipTrigger>
                        <TooltipContent side='left'><ViewModeTooltip mode={cardViewMode} /></TooltipContent>
                     </Tooltip>
                  )}

                  { isEditing && onDelete &&
                     <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-7 w-7 cursor-pointer border border-card-border hover:bg-destructive/60"
                        onClick={onDelete}
                     >
                        <Trash2 className="h-4 w-4" />
                     </Button>
                  }
               </div>
            </motion.div>
         )}
      </AnimatePresence>
   );
}
