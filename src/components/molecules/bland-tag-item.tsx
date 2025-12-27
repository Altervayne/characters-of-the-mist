

// -- React Imports --
import React, { useEffect, useState } from 'react';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Basic UI Imports --
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Trash2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';

// -- Type Imports --
import type { BlandTag } from '@/lib/types/character';



interface BlandTagItemProps {
  cardId: string;
  tag: BlandTag;
  listName: 'quintessences' | 'improvements' | 'backpack' | 'nemeses' | 'specials';
  isEditing: boolean;
  index: number;
}



export function BlandTagItem({ cardId, tag, listName, isEditing, index }: BlandTagItemProps) {
   const { t } = useTranslation();
   const { updateBlandTag, removeBlandTag } = useCharacterActions();

   const isEvenRow = index % 2 === 0;

   // ###########################
   // ###   INPUT DEBOUNCER   ###
   // ###########################

   const [localName, setLocalName] = useState(tag.name);

   useEffect(() => {
     const handler = setTimeout(() => {
       if (tag.name !== localName) {
         updateBlandTag(cardId, listName, tag.id, localName);
       }
     }, 500);

     return () => clearTimeout(handler);
   }, [localName, cardId, listName, tag.id, tag.name, updateBlandTag]);

   useEffect(() => {
     setLocalName(tag.name);
   }, [tag.name]);



   return (
      <div className={cn(
         "flex items-center gap-2 text-sm p-1",
         isEvenRow ? 'bg-black/5' : 'bg-transparent'
      )}>
         {isEditing ? (
            <>
               <Input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="h-7 flex-1 bg-transparent text-center border-none shadow-none"
                  placeholder={t('placeholder')}
               />
               <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeBlandTag(cardId, listName, tag.id)}
               >
                  <Trash2 className="h-4 w-4" />
               </Button>
            </>
         ) : (
            <span className="w-full text-center">{tag.name ? tag.name : `[${t('noName')}]`}</span>
         )}
      </div>
   );
}
