'use client';

// -- React Imports --
import React, { useEffect, useRef, useState } from 'react';

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
import { Circle, Disc2, Flame, PlusCircle } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { ToolbarHandle } from '../molecules/toolbar-handle';
import { TagItem } from '../molecules/tag-item';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useManualScroll } from '@/hooks/useManualScroll';

// -- Type Imports --
import { StoryThemeTracker } from '@/lib/types/character';



interface StoryThemeTrackerCardProps {
   tracker: StoryThemeTracker;
   isEditing?: boolean;
   isDrawerPreview?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onExport?: () => void;
}



export function StoryThemeTrackerCard({ tracker, isEditing = false, isDrawerPreview = false, dragAttributes, dragListeners, onExport }: StoryThemeTrackerCardProps) {
   const tThemeCard = useTranslations('ThemeCard');
   const actions = useCharacterActions();
   const [isHovered, setIsHovered] = useState(false);
   const scrollRef = useRef<HTMLDivElement>(null);
   useManualScroll(scrollRef);

   const isTrackersAlwaysEditable = useAppSettingsStore((s) => s.isTrackersAlwaysEditable);
   const isEffectivelyEditing = isEditing || isTrackersAlwaysEditable;

   // Determine card theme based on game system
   const cardTheme = tracker.game === 'CITY_OF_MIST'
      ? 'card-type-tracker-city'
      : tracker.game === 'OTHERSCAPE'
         ? 'card-type-tracker-otherscape'
         : 'card-type-story-theme';



   // ################################################
   // ###   STORY THEME MAIN TAG INPUT DEBOUNCER   ###
   // ################################################

   const [localMainTagName, setLocalMainTagName] = useState(tracker.mainTag.name);
   useEffect(() => {
      const handler = setTimeout(() => {
         if (tracker.mainTag.name !== localMainTagName) {
            actions.updateTagInStoryTheme(tracker.id, 'mainTag', tracker.mainTag.id, { name: localMainTagName });
            actions.updateStoryTheme(tracker.id, { name: localMainTagName });
         }
      }, 500);
      return () => clearTimeout(handler);
   }, [localMainTagName, tracker.id, tracker.mainTag, tracker.name, actions]);
   useEffect(() => { setLocalMainTagName(tracker.mainTag.name); }, [tracker.mainTag.name]);



   return (
      <motion.div
         onHoverStart={() => setIsHovered(true)}
         onHoverEnd={() => setIsHovered(false)}
         className="relative"
      >
         { !isDrawerPreview &&
            <ToolbarHandle
               isEditing={isEffectivelyEditing}
               isHovered={isHovered}
               dragAttributes={dragAttributes}
               dragListeners={dragListeners}
               onDelete={() => actions.removeStoryTheme(tracker.id)}
               onDowngradeStoryTheme={() => actions.downgradeStoryThemeToTag(tracker.id)}
               onExport={onExport}
               cardTheme={cardTheme}
               side="top"
            />
         }

         <div className={cn(
            isHovered ? "z-1" : "z-0",
            "relative z-0 flex flex-col h-[220px] w-[250px] border-2 rounded-lg overflow-hidden",
            cardTheme,
            "border-card-border bg-card-paper-bg text-card-paper-fg",
            {"h-[120px] shadow-none pointer-events-none border-2 border-card-border": isDrawerPreview}
         )}>

            <div className="flex-grow flex flex-col min-h-0">
               {/* Main Tag Section */}
               <div className="w-full text-center p-1 flex-shrink-0 flex items-center justify-between gap-2 border-b-2 border-card-accent/30 bg-card-header-bg text-card-header-fg">
                  {isEffectivelyEditing ? (
                     <Input
                        className="text-lg font-bold text-center flex-grow border-0 shadow-none bg-card-paper-bg text-card-paper-fg"
                        placeholder={tThemeCard('placeholderName')}
                        value={localMainTagName}
                        onChange={(e) => setLocalMainTagName(e.target.value)}
                     />
                  ) : (
                     <>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.updateTagInStoryTheme(tracker.id, 'mainTag', tracker.mainTag.id, { isActive: !tracker.mainTag.isActive })}>
                           {tracker.mainTag.isActive ? <Disc2 className="h-5 w-5 text-primary" /> : <Circle className="h-4 w-4" />}
                        </Button>
                        <h3 className={cn("text-lg font-bold", tracker.mainTag.isScratched ? 'line-through opacity-50' : tracker.mainTag.isActive && 'underline')}>
                           {tracker.mainTag.name || `[${tThemeCard('noName')}]`}
                        </h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.updateTagInStoryTheme(tracker.id, 'mainTag', tracker.mainTag.id, { isScratched: !tracker.mainTag.isScratched })}>
                           <Flame className={cn('h-4 w-4', tracker.mainTag.isScratched && 'text-destructive fill-destructive')} />
                        </Button>
                     </>
                  )}
               </div>

               {/* Sub-tags */}
               <div
                  ref={scrollRef}
                  className={cn(
                     "flex-grow",
                     isDrawerPreview ? "overflow-y-hidden" : "overflow-y-scroll overscroll-contain"
                  )}
               >
                  {/* Power Tags */}
                  {tracker.powerTags.map((tag, index) => <TagItem key={tag.id} trackerId={tracker.id} tag={tag} tagType="power" isEditing={isEffectivelyEditing} index={index} isTrackerTag />)}
                  {isEffectivelyEditing && <div className="p-2"><Button variant="ghost" size="sm" className="w-full p-2 border-1 border-dashed" onClick={() => actions.addTagToStoryTheme(tracker.id, 'powerTags')}><PlusCircle className="h-4 w-4 mr-2"/>{tThemeCard('addPowerTag')}</Button></div>}

                  {/* Weakness Tags */}
                  {tracker.weaknessTags.map((tag, index) => <TagItem key={tag.id} trackerId={tracker.id} tag={tag} tagType="weakness" isEditing={isEffectivelyEditing} index={index} isTrackerTag />)}
                  {isEffectivelyEditing && <div className="p-2"><Button variant="ghost" size="sm" className="w-full border-1 border-dashed" onClick={() => actions.addTagToStoryTheme(tracker.id, 'weaknessTags')}><PlusCircle className="h-4 w-4 mr-2"/>{tThemeCard('addWeaknessTag')}</Button></div>}
               </div>
            </div>
         </div>
      </motion.div>
   );
}