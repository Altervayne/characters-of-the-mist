// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Component Imports --
import { CardRenderer } from '@/components/organisms/cards/CardRenderer';
import { StatusTrackerCard } from '@/components/organisms/trackers/StatusTracker';
import { StoryTagTrackerCard } from '@/components/organisms/trackers/StoryTagTracker';
import { StoryThemeTrackerCard } from '@/components/organisms/trackers/StoryThemeTracker';
import { DrawerCompactItemEntry } from '@/components/molecules/drawer/DrawerCompactItemEntry';
import { DrawerItemPreview, FolderPreview } from '@/components/organisms/drawer/DrawerItemPreview';

// -- Type Imports --
import type { Card as CardData, Tracker } from '@/lib/types/character';
import type { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';



interface DragOverlayContentProps {
   activeDragItem: CardData | Tracker | DrawerItem | FolderType | null;
   isEditing: boolean;
   isCompactDrawer: boolean;
}

/**
 * Content rendered inside the DnD `<DragOverlay>`. Picks the correct drag preview
 * based on the shape of `activeDragItem`: a folder, a sheet card, a tracker, or a
 * drawer item (compact or full preview). Renders nothing when no drag is active.
 */
export function DragOverlayContent({ activeDragItem, isEditing, isCompactDrawer }: DragOverlayContentProps) {
   if (!activeDragItem) {
      return null;
   }

   return (
      <motion.div className="shadow-2xl rounded-lg">
         {'folders' in activeDragItem ? (
            <FolderPreview folder={activeDragItem as FolderType} />
         ) : 'cardType' in activeDragItem ? (
            <CardRenderer card={activeDragItem} isEditing={isEditing} isSnapshot={true}/>
         ) : 'trackerType' in activeDragItem ? (
            (activeDragItem.trackerType === 'STATUS') ? <StatusTrackerCard tracker={activeDragItem} isEditing={isEditing} /> :
            (activeDragItem.trackerType === 'STORY_TAG') ? <StoryTagTrackerCard tracker={activeDragItem} isEditing={isEditing} /> :
            <StoryThemeTrackerCard tracker={activeDragItem} isEditing={isEditing} />
         ) : 'game' in activeDragItem ? (
            isCompactDrawer ? (
               <DrawerCompactItemEntry item={activeDragItem as DrawerItem} isPreview={true} />
            ) : (
               <DrawerItemPreview item={activeDragItem as DrawerItem} />
            )
         ) : null}
      </motion.div>
   );
}
