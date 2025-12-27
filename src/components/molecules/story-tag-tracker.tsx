

// -- React Imports --
import React, { useEffect, useState } from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// -- Icon Imports --
import { Trash2, Flame } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { ToolbarHandle } from './toolbar-handle';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { StoryTagTracker } from '@/lib/types/character';
import type { useAppSettingsStore } from '@/lib/stores/appSettingsStore';



interface StoryTagTrackerCardProps {
   tracker: StoryTagTracker;
   isEditing?: boolean;
   isDrawerPreview?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onExport?: () => void;
}



export function StoryTagTrackerCard({ tracker, isEditing=false, isDrawerPreview, dragAttributes, dragListeners, onExport }: StoryTagTrackerCardProps) {
   const { t: t } = useTranslation();
   const { updateStoryTag, removeStoryTag, upgradeStoryTagToTheme } = useCharacterActions();
   const [isHovered, setIsHovered] = useState(false);

   const isTrackersAlwaysEditable = useAppSettingsStore((s) => s.isTrackersAlwaysEditable);
   const isEffectivelyEditing = isEditing || isTrackersAlwaysEditable;

   // Determine card theme based on game system
   const cardTheme = tracker.game === 'CITY_OF_MIST'
      ? 'card-type-tracker-city'
      : tracker.game === 'OTHERSCAPE'
         ? 'card-type-tracker-otherscape'
         : 'card-type-tracker-legends';



   // ##########################################
   // ###   STORY TAG NAME INPUT DEBOUNCER   ###
   // ##########################################

   const [localName, setLocalName] = useState(tracker.name);

   useEffect(() => {
      const handler = setTimeout(() => {
         if (tracker.name !== localName) {
            updateStoryTag(tracker.id, { name: localName });
         }
      }, 500);
      return () => clearTimeout(handler);
   }, [localName, tracker.id, tracker.name, updateStoryTag]);

   useEffect(() => {
      setLocalName(tracker.name);
   }, [tracker.name]);



   return (
      <motion.div
         onHoverStart={() => !isDrawerPreview && setIsHovered(true)}
         onHoverEnd={() => !isDrawerPreview && setIsHovered(false)}
         className="relative"
      >
         {!isDrawerPreview && (
            <ToolbarHandle
               isEditing={isEffectivelyEditing}
               isHovered={isHovered}
               dragAttributes={dragAttributes}
               dragListeners={dragListeners}
               onExport={onExport}
               onStoryTagNegative={() => updateStoryTag(tracker.id, { isWeakness: !tracker.isWeakness })}
               isStoryTagNegative={tracker.isWeakness}
               onUpgradeStoryTag={() => upgradeStoryTagToTheme(tracker.id)}
               cardTheme={cardTheme}
               side="top"
            />
         )}

         <div className={cn(
            isHovered ? "z-1" : "z-0",
            "relative flex items-center justify-between h-13.75 w-55 p-2 rounded-lg border-2",
            {"pointer-events-none shadow-none border-2 border-border": isDrawerPreview},
            cardTheme, "border-card-border",
            tracker.isWeakness 
               ? "bg-card-destructive-bg text-card-destructive-fg" 
               : "bg-card-paper-bg text-card-paper-fg"
         )}>
            {isEffectivelyEditing ? (
               <>
                  <div className="grow p-1">
                     <Input
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="h-8 text-card-paper-fg font-semibold border-dashed bg-transparent placeholder-card-paper-fg"
                        placeholder={t('Trackers.storyTagPlaceholder')}
                     />
                  </div>
                  <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 text-destructive cursor-pointer"
                     onClick={() => removeStoryTag(tracker.id)}
                  >
                     <Trash2 className="h-5 w-5" />
                  </Button>
               </>
            ) : (
               <>
                  <div className="grow p-1">
                     <span className={cn("text-card-paper-fg font-semibold", tracker.isScratched && 'line-through opacity-50')}>
                        {tracker.name ? tracker.name : `[${t('Trackers.storyTagNoName')}]`}
                     </span>
                  </div>
                  <Button 
                     variant="ghost" 
                     size="icon" 
                     className="h-8 w-8 cursor-pointer"
                     onClick={() => updateStoryTag(tracker.id, { isScratched: !tracker.isScratched })}
                  >
                     <Flame className={cn('h-5 w-5', tracker.isScratched && 'text-destructive fill-destructive')} />
                  </Button>
               </>
            )}
         </div>

      </motion.div>
   );
}
