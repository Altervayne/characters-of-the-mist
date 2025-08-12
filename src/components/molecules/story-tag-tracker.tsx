'use client';

// -- React Imports --
import React, { useEffect, useState } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

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
import { StoryTagTracker } from '@/lib/types/character';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';



interface StoryTagTrackerCardProps {
   tracker: StoryTagTracker;
   isEditing?: boolean;
   isDrawerPreview?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onExport?: () => void;
}



export function StoryTagTrackerCard({ tracker, isEditing=false, isDrawerPreview, dragAttributes, dragListeners, onExport }: StoryTagTrackerCardProps) {
   const t = useTranslations('Trackers');
   const { updateStoryTag, removeStoryTag } = useCharacterActions();
   const [isHovered, setIsHovered] = useState(false);

   const isTrackersAlwaysEditable = useAppSettingsStore((s) => s.isTrackersAlwaysEditable);
   const isEffectivelyEditing = isEditing || isTrackersAlwaysEditable;



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
               cardTheme='card-type-tracker'
               side="top"
            />
         )}

         <div className={cn(
            isHovered ? "z-1" : "z-0",
            "relative flex items-center justify-between h-[55px] w-[220px] p-2 rounded-lg border-2",
            {"pointer-events-none shadow-none border-2 border-border": isDrawerPreview},
            "card-type-tracker",
            "border-card-border bg-card-paper-bg text-card-paper-fg",
         )}>
            {isEffectivelyEditing ? (
               <>
                  <div className="flex-grow p-1">
                     <Input
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="h-8 text-card-paper-fg font-semibold border-dashed bg-transparent placeholder-card-paper-fg"
                        placeholder={t('storyTagPlaceholder')}
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
                  <div className="flex-grow p-1">
                     <span className={cn("text-card-paper-fg font-semibold", tracker.isScratched && 'line-through opacity-50')}>
                        {tracker.name ? tracker.name : `[${t('storyTagNoName')}]`}
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
