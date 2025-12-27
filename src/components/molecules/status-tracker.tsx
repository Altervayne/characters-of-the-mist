

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
import { Check, Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { ToolbarHandle } from './toolbar-handle';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { StatusTracker } from '@/lib/types/character';



interface StatusTrackerCardProps {
   tracker: StatusTracker;
   isEditing?: boolean;
   isDrawerPreview?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onExport?: () => void;
}



export function StatusTrackerCard({ tracker, isEditing=false, isDrawerPreview, dragAttributes, dragListeners, onExport }: StatusTrackerCardProps) {
   const { t: t } = useTranslation();
   const { updateStatus, removeStatus } = useCharacterActions();
   const [isHovered, setIsHovered] = useState(false);

   const isTrackersAlwaysEditable = useAppSettingsStore((s) => s.isTrackersAlwaysEditable);
   const isEffectivelyEditing = isEditing || isTrackersAlwaysEditable;

   // Determine card theme based on game system
   const cardTheme = tracker.game === 'CITY_OF_MIST'
      ? 'card-type-tracker-city'
      : tracker.game === 'OTHERSCAPE'
         ? 'card-type-tracker-otherscape'
         : 'card-type-tracker-legends';

   const handleTierClick = (tierIndex: number) => {
      if (isDrawerPreview) return;

      const newTiers = [...tracker.tiers];
      newTiers[tierIndex] = !newTiers[tierIndex];
      updateStatus(tracker.id, { tiers: newTiers });
   };



   // #######################################
   // ###   STATUS NAME INPUT DEBOUNCER   ###
   // #######################################

   const [localName, setLocalName] = useState(tracker.name);

   useEffect(() => {
      const handler = setTimeout(() => {
         if (tracker.name !== localName) {
            updateStatus(tracker.id, { name: localName });
         }
      }, 500);
      return () => clearTimeout(handler);
   }, [localName, tracker.id, tracker.name, updateStatus]);

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
               cardTheme={cardTheme}
               side="top"
            />
         )}

         <div className={cn(
            isHovered ? "z-1" : "z-0",
            "relative z-0 flex flex-col h-25 w-55 border-2 rounded-lg overflow-hidden",
            {"pointer-events-none shadow-none border-2 border-border": isDrawerPreview},
            cardTheme,
            "border-card-border bg-card-paper-bg text-card-paper-fg",
         )}>
            {/* Header Section */}
            <div className={cn(
               "flex items-center border-b",
               "text-card-header-fg bg-card-header-bg"
            )}>
               <div className="grow p-1">
                  {isEffectivelyEditing ? (
                     <Input
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="h-8 font-semibold border-dashed border-card-accent bg-card-paper-bg text-card-paper-fg placeholder-card-paper-fg"
                        placeholder={t('Trackers.statusPlaceholder')}
                     />
                  ) : (
                     <p className="text-base font-semibold px-2">{tracker.name ? tracker.name : `[${t('Trackers.statusNoName')}]`}</p>
                  )}
               </div>
               {isEffectivelyEditing && (
                  <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8 mr-1 text-destructive bg-card-paper-bg shrink-0 cursor-pointer"
                     onClick={() => removeStatus(tracker.id)}
                  >
                     <Trash2 className="h-5 w-5" />
                  </Button>
               )}
            </div>

            {/* Tiers Section */}
            <div className="flex grow">
               {tracker.tiers.map((isActive, index) => (
                  <div 
                     key={index} 
                     className={cn(
                     "flex-1 flex flex-col justify-between items-end p-1 cursor-pointer",
                     index % 2 === 0 ? 'bg-black/5' : 'bg-transparent'
                     )}
                     onClick={() => handleTierClick(index)}
                  >
                     <Check className={cn("h-6 w-6 transition-opacity", isActive ? 'opacity-100 text-card-paper-fg' : 'opacity-0')} />
                     <span className="text-xl font-bold text-card-paper-fg">{index + 1}</span>
                  </div>
               ))}
            </div>
         </div>
      </motion.div>
   );
}
