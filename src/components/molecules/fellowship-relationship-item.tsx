

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
import type { FellowshipRelationship } from '@/lib/types/character';



interface FellowshipRelationshipItemProps {
   cardId: string;
   relationship: FellowshipRelationship;
   isEditing: boolean;
   index: number;
   translationNamespace?: string;
}



export function FellowshipRelationshipItem({ cardId, relationship, isEditing, index }: FellowshipRelationshipItemProps) {
   const { t } = useTranslation();
   const { updateRelationship, removeRelationship } = useCharacterActions();

   const isEvenRow = index % 2 === 0;
   const bgColor = isEvenRow ? 'bg-black/5' : 'bg-black/2';



   // ###########################
   // ###   INPUT DEBOUNCER   ###
   // ###########################

   // --- Companion Name ---
   const [localCompanionName, setLocalCompanionName] = useState(relationship.companionName);

   useEffect(() => {
      const handler = setTimeout(() => {
         if (relationship.companionName !== localCompanionName) {
            updateRelationship(cardId, relationship.id, { companionName: localCompanionName });
         }
      }, 500);
      return () => clearTimeout(handler);
   }, [localCompanionName, relationship, cardId, updateRelationship]);

   useEffect(() => {
      setLocalCompanionName(relationship.companionName);
   }, [relationship.companionName]);


   // --- Relationship Tag ---
   const [localRelationshipTag, setLocalRelationshipTag] = useState(relationship.relationshipTag);

   useEffect(() => {
      const handler = setTimeout(() => {
         if (relationship.relationshipTag !== localRelationshipTag) {
            updateRelationship(cardId, relationship.id, { relationshipTag: localRelationshipTag });
         }
      }, 500);
      return () => clearTimeout(handler);
   }, [localRelationshipTag, relationship, cardId, updateRelationship]);

   useEffect(() => {
      setLocalRelationshipTag(relationship.relationshipTag);
   }, [relationship.relationshipTag]);



   return (
      <div className={cn("flex items-center gap-2 text-sm p-1",
         bgColor
      )}>
         {isEditing ? (
            <Input
               value={localCompanionName}
               onChange={(e) => setLocalCompanionName(e.target.value)}
               className="h-7 flex-1 border-dashed"
               placeholder={t('companionPlaceholder')}
            />
         ) : (
            <span className="flex-1 font-semibold text-center">{relationship.companionName ? relationship.companionName : `[${t('relationshipCompanionNoName')}]`}</span>
         )}

         {isEditing ? (
            <Input
               value={localRelationshipTag}
               onChange={(e) => setLocalRelationshipTag(e.target.value)}
               className="h-7 flex-1 border-dashed italic"
               placeholder={t('relationshipPlaceholder')}
            />
         ) : (
            <span className="flex-1 italic text-muted-foreground text-center">&quot;{relationship.relationshipTag ? relationship.relationshipTag : `[${t('relationshipRelationNoName')}]`}&quot;</span>
         )}

         {isEditing && (
            <Button
               variant="ghost"
               size="icon"
               className="h-7 w-7 text-destructive cursor-pointer"
               onClick={() => removeRelationship(cardId, relationship.id)}
            >
               <Trash2 className="h-4 w-4" />
            </Button>
         )}
      </div>
   );
}
