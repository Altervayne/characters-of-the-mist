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

   // A dragged drawer folder is a flat DrawerFolderRecord (id/name/parentFolderId/
   // order) — it has none of the discriminants the other drag sources carry
   // (`cardType`/`trackerType`/`game`), and crucially NOT `folders`, so the old
   // `'folders' in item` check never matched it and a folder drag showed no clone.
   // Detect it by elimination instead, then render its folder preview.
   const isFolder =
      !('cardType' in activeDragItem) && !('trackerType' in activeDragItem) && !('game' in activeDragItem);

   return (
      <motion.div className="shadow-2xl rounded-lg">
         {isFolder ? (
            <FolderPreview folder={activeDragItem as unknown as FolderType} />
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
