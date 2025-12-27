

// -- React Imports --
import React, { useEffect, useState } from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Circle, Disc2, Flame, Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { Tag } from '@/lib/types/character';



interface TagItemProps {
   tag: Tag;
   tagType: 'power' | 'weakness';
   isEditing: boolean;
   index: number;
   cardId?: string;
   trackerId?: string;
   isTrackerTag?: boolean;
   isLoadoutGear?: boolean;
}



export function TagItem({ tag, tagType, isEditing, index, cardId, trackerId, isTrackerTag, isLoadoutGear }: TagItemProps) {
   const { t: t } = useTranslation();
   const actions = useCharacterActions();
   const listName = tagType === 'power' ? 'powerTags' : 'weaknessTags';

   const isEvenRow = index % 2 === 0;
   const powerBg = isEvenRow ? 'bg-black/5' : 'bg-black/2';
   const weaknessBg = isEvenRow ? 'bg-destructive/10' : 'bg-destructive/5';



   // ####################################
   // ###   TAG NAME INPUT DEBOUNCER   ###
   // ####################################

   const [localName, setLocalName] = useState(tag.name);

   useEffect(() => {
      const handler = setTimeout(() => {
         if (tag.name !== localName) {
         if (isTrackerTag && trackerId) {
            actions.updateTagInStoryTheme(trackerId, listName, tag.id, { name: localName });
         } else if (cardId) {
            actions.updateTag(cardId, listName, tag.id, { name: localName });
         }
         }
      }, 500);
      return () => clearTimeout(handler);
   }, [localName, tag.name, tag.id, listName, cardId, trackerId, isTrackerTag, actions]);

   useEffect(() => { setLocalName(tag.name); }, [tag.name]);



   const handleUpdate = (updates: Partial<Tag>) => {
      if (isTrackerTag && trackerId) {
         actions.updateTagInStoryTheme(trackerId, listName, tag.id, updates);
      } else if (cardId) {
         actions.updateTag(cardId, listName, tag.id, updates);
      }
   };

   const handleRemove = () => {
      if (isTrackerTag && trackerId) {
         actions.removeTagFromStoryTheme(trackerId, listName, tag.id);
      } else if (cardId) {
         actions.removeTag(cardId, listName, tag.id);
      }
   };



   return (
      <div
         className={cn(
            'flex items-center justify-between px-1 py-0.5 w-full',
            tagType === 'power' ? powerBg : weaknessBg,
            tag.isScratched && 'opacity-50'
         )}
         style={tagType === 'weakness' ? (isEvenRow
            ? { backgroundColor: 'color-mix(in srgb, var(--card-destructive-bg, transparent) 25%, transparent)' }
            : { backgroundColor: 'color-mix(in srgb, var(--card-destructive-bg, transparent) 18%, transparent)' }
         ) : undefined}
      >
         <div className="flex items-center justify-center w-6">
            {tagType === 'power' && !isEditing && (
               <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => handleUpdate({ isActive: !tag.isActive })}>
                  {tag.isActive ? <Disc2 className="h-5 w-5 text-card-paper" /> : <Circle className="h-4 w-4" />}
               </Button>
            )}
         </div>

         {isEditing ? (
            <Input
               value={localName}
               onChange={(e) => setLocalName(e.target.value)}
               className="mx-1 h-7 text-center text-sm border-0 shadow-none"
               placeholder={t('TagItem.placeholder')}
            />
         ) : (
            <p className={cn('text-sm text-center py-1', tag.isScratched && !isLoadoutGear ? 'line-through' : tag.isActive && 'underline')}>
               {tag.name || `[${t('TagItem.noName')}]`}
            </p>
         )}

         <div className="flex items-center justify-center w-6">
            {isEditing ? (
               <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive cursor-pointer" onClick={handleRemove}>
                  <Trash2 className="h-4 w-4" />
               </Button>
            ) : (
               tagType === 'power' && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => handleUpdate({ isScratched: !tag.isScratched })}>
                     <Flame className={cn('h-4 w-4', tag.isScratched && 'text-destructive fill-destructive')} />
                  </Button>
               )
            )}
         </div>
      </div>
   );
}
