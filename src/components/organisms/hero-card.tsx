// -- React Imports --
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

// -- Basic UI Imports --
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// -- Icon Imports --
import { PlusCircle, Users, Sparkles } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { CardHeaderMolecule } from '../molecules/card-header';
import { CardSectionHeader } from '@/components/molecules/card-section-header';
import { PipTracker } from '@/components/molecules/pip-tracker';
import { FellowshipRelationshipItem } from '@/components/molecules/fellowship-relationship-item';
import { BlandTagItem } from '../molecules/bland-tag-item';
import { CardFlipWrapper } from '../molecules/card-flip-wrapper';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useManualScroll } from '@/hooks/useManualScroll';
import { useToolbarHover } from '@/hooks/useToolbarHover';
import { useInputDebouncer } from '@/hooks/useInputDebouncer';

// -- Type Imports --
import type { Card as CardData, CardViewMode, LegendsHeroDetails } from '@/lib/types/character';



interface HeroCardProps {
  card: CardData;
  isEditing?: boolean;
  isSnapshot?: boolean;
  isDrawerPreview?: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  onExport?: () => void;
}



const HeroCardContent = React.forwardRef<HTMLDivElement, HeroCardProps>(
   ({ card, isEditing=false, isSnapshot, isDrawerPreview, dragAttributes, dragListeners, onExport }, ref) => {
      const { t: t } = useTranslation();
      const { t: tBackpack } = useTranslation();
      const actions = useCharacterActions();
      const details = card.details as LegendsHeroDetails;

      const { isHovered, hoverHandlers } = useToolbarHover(isDrawerPreview);

      const globalCardViewMode = useAppSettingsStore((state) => state.isSideBySideView ? 'SIDE_BY_SIDE' : 'FLIP');
      const effectiveViewMode = useMemo(() => card.viewMode || globalCardViewMode, [card.viewMode, globalCardViewMode]);

      const relationshipsScrollRef = useRef<HTMLDivElement>(null);
      const quintessencesScrollRef = useRef<HTMLDivElement>(null);
      const backpackScrollRef = useRef<HTMLDivElement>(null);

      useManualScroll(relationshipsScrollRef);
      useManualScroll(quintessencesScrollRef);
      useManualScroll(backpackScrollRef);


      
      const handleDetailChange = (field: keyof LegendsHeroDetails, value: LegendsHeroDetails[keyof LegendsHeroDetails]) => {
         actions.updateCardDetails(card.id, { ...details, [field]: value });
      };



      const handleCycleViewMode = () => {
         let nextMode: CardViewMode | null = null;
         if (card.viewMode === 'SIDE_BY_SIDE') {
            nextMode = 'FLIP';
         } else if (card.viewMode === 'FLIP') {
            nextMode = null;
         } else {
            nextMode = 'SIDE_BY_SIDE';
         }
         actions.updateCardViewMode(card.id, nextMode);
      };



      // ##########################################
      // ###   CHARACTER NAME INPUT DEBOUNCER   ###
      // ##########################################

      const [localCharName, setLocalCharName] = useInputDebouncer(
         details.characterName,
         (value) => actions.updateCharacterName(value)
      );



      const CardFront = (
         <Card className={cn(
            "w-62.5 h-150 flex flex-col border-2 shadow-lg p-0 overflow-hidden gap-0",
            "bg-card-paper-bg text-card-paper-fg border-card-accent",
            "relative z-0",
            "card-type-hero",
            {"h-30 shadow-none pointer-events-none border-2 border-card-border": isDrawerPreview}
         )}>
            <CardHeader className="p-0">
               <CardHeaderMolecule title={t('HeroCard.title')}></CardHeaderMolecule>
            </CardHeader>
            
            <CardContent className="grow flex flex-col p-0 overflow-hidden min-h-0">
               <div className="w-full text-center px-2 py-1 mb-1 shrink-0">
                  {isEditing ? (
                     <Input
                        className="text-2xl font-bold text-center bg-transparent border-none shadow-none"
                        value={localCharName || ''}
                        onChange={(e) => setLocalCharName(e.target.value)}
                        placeholder={t('HeroCard.characterNamePlaceholder')}
                     />
                  ) : (
                     <h2 className="text-2xl font-bold">{details.characterName || `[${t('HeroCard.noName')}]`}</h2>
                  )}
               </div>

               <div className="flex flex-col h-[45%]">
                  <CardSectionHeader title={t('HeroCard.relationships')} icon={Users} />
                  <div className="flex flex-col grow align-middle overflow-y-auto overscroll-contain" ref={relationshipsScrollRef}>
                     <div className="flex bg-card-accent/15">
                        <p className="grow text-sm text-center py-1 border-b">{t('HeroCard.companion')}</p>
                        <p className="grow text-sm text-center py-1 border-b">{t('HeroCard.relationship')}</p>
                     </div>
                     {details.fellowshipRelationships.map((relation, index) => (
                        <FellowshipRelationshipItem key={relation.id} cardId={card.id} relationship={relation} isEditing={isEditing} index={index} />
                     ))}
                     {isEditing && (
                        <Button variant="ghost" size="sm" className="m-2 border border-dashed cursor-pointer" onClick={() => actions.addRelationship(card.id)}>
                           <PlusCircle className="h-4 w-4 mr-2" /> {t('HeroCard.addRelationship')}
                        </Button>
                     )}
                  </div>
               </div>

               <div className="flex justify-around items-center py-2 px-2 shrink-0 w-full border-t border-black/30">
                  <PipTracker 
                     label="promise" 
                     value={details.promise} 
                     onUpdate={(val) => handleDetailChange('promise', val)}
                     maxPips={5}
                  />
               </div>

               <div className="flex flex-col grow overflow-hidden">
                  <CardSectionHeader title={t('HeroCard.quintessences')} icon={Sparkles} />
                  <div className="flex flex-col grow align-middle overflow-y-scroll overscroll-contain" ref={quintessencesScrollRef}>
                     {details.quintessences.map((quint, index) => (
                        <BlandTagItem 
                           key={quint.id} 
                           cardId={card.id} 
                           tag={quint} 
                           listName="quintessences" 
                           isEditing={isEditing} 
                           index={index} 
                        />
                     ))}
                     {isEditing && (
                        <Button variant="ghost" size="sm" className="m-2 border border-dashed cursor-pointer" onClick={() => actions.addBlandTag(card.id, 'quintessences')}>
                           <PlusCircle className="h-4 w-4 mr-2" /> {t('HeroCard.addQuintessence')}
                        </Button>
                     )}
                  </div>
               </div>
            </CardContent>
         </Card>
      );

      const CardBack = (
         <Card className={cn(
            "w-62.5 h-150 flex flex-col border-2 shadow-lg p-0 overflow-hidden gap-0",
            "bg-card-paper-bg text-card-paper-fg border-card-accent",
            "relative z-0",
            "card-type-hero",
            {"h-30 shadow-none pointer-events-none border-2 border-card-border": isDrawerPreview}
         )}>
            <CardHeaderMolecule title={t('HeroCard.title')} />
            <CardSectionHeader title={`${tBackpack('backpack.title')}`}></CardSectionHeader>
            <CardContent className="grow flex flex-col p-0 overflow-hidden min-h-0">
               <div className="grow space-y-0 overflow-y-auto overscroll-contain" ref={backpackScrollRef}>
                  {details.backpack.map((tag, index) => (
                     <BlandTagItem 
                        key={tag.id}
                        cardId={card.id}
                        tag={tag}
                        listName="backpack"
                        isEditing={isEditing}
                        index={index}
                     />
                  ))}
                  {isEditing && (
                     <div className="p-2 w-full">
                        <Button variant="ghost" size="sm" className="w-full border border-dashed cursor-pointer" onClick={() => actions.addBlandTag(card.id, 'backpack')}>
                           <PlusCircle className="h-4 w-4 mr-2" /> {tBackpack('backpack.addItem')}
                        </Button>
                     </div>
                  )}
               </div>
            </CardContent>
         </Card>
      );



      return (
         <CardFlipWrapper
            ref={ref}
            effectiveViewMode={effectiveViewMode}
            isDrawerPreview={isDrawerPreview ?? false}
            isSnapshot={isSnapshot}
            card={card}
            isHovered={isHovered}
            hoverHandlers={hoverHandlers}
            isEditing={isEditing}
            dragAttributes={dragAttributes}
            dragListeners={dragListeners}
            cardTheme="card-type-hero"
            onExport={onExport}
            onCycleViewMode={handleCycleViewMode}
            onFlip={() => actions.flipCard(card.id)}
            cardFront={CardFront}
            cardBack={CardBack}
         />
      );
   }
);
HeroCardContent.displayName = 'HeroCardContent';



export const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  (props, ref) => {
    if (props.card.details.game !== 'LEGENDS') {
      return null;
    }
    return <HeroCardContent {...props} ref={ref} />;
  }
);
HeroCard.displayName = 'HeroCard';