'use client';

// -- React Imports --
import React, { useEffect, useMemo, useRef, useState } from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { motion } from 'framer-motion';
import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

// -- Basic UI Imports --
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// -- Icon Imports --
import { Flame, Circle, PlusCircle, Disc2 } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Component Imports --
import { CardHeaderMolecule } from '../molecules/card-header';
import { CardSectionHeader } from '@/components/molecules/card-section-header';
import { TagItem } from '@/components/molecules/tag-item';
import { PipTracker } from '@/components/molecules/pip-tracker';
import { BlandTagItem } from '@/components/molecules/bland-tag-item';
import { ToolbarHandle } from '@/components/molecules/toolbar-handle';

// -- Store and Hook Imports --
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useManualScroll } from '@/hooks/useManualScroll';

// -- Type Imports --
import { Card as CardData, CardViewMode, CityThemeDetails, CityCrewDetails, Tag, BlandTag } from '@/lib/types/character';

interface CityThemeCardProps {
   card: CardData;
   isEditing?: boolean;
   isSnapshot?: boolean;
   isDrawerPreview?: boolean;
   dragAttributes?: DraggableAttributes;
   dragListeners?: SyntheticListenerMap;
   onEditCard?: () => void;
   onExport?: () => void;
}



export const CityThemeCard = React.forwardRef<HTMLDivElement, CityThemeCardProps>(
   ({ card, isEditing=false, isSnapshot, isDrawerPreview, dragAttributes, dragListeners, onEditCard, onExport }, ref) => {
      const t = useTranslations('ThemeCard');
      const actions = useCharacterActions();
      const details = card.details as CityThemeDetails | CityCrewDetails;

      const [isHovered, setIsHovered] = useState(false);

      const globalCardViewMode = useAppSettingsStore((state) => state.isSideBySideView ? 'SIDE_BY_SIDE' : 'FLIP');
      const effectiveViewMode = useMemo(() => card.viewMode || globalCardViewMode, [card.viewMode, globalCardViewMode]);

      const tagsScrollRef = useRef<HTMLDivElement>(null);
      const mysteryScrollRef = useRef<HTMLDivElement>(null);
      const improvementsScrollRef = useRef<HTMLDivElement>(null);

      useManualScroll(tagsScrollRef);
      useManualScroll(mysteryScrollRef);
      useManualScroll(improvementsScrollRef);



      const cardTypeClass = (() => {
         if (card.cardType === 'CHARACTER_THEME') {
            // City of Mist uses -com suffix to differentiate from Otherscape
            return `card-type-${(details as CityThemeDetails).themeType.toLowerCase().replace(/\s+/g, '-')}-com`;
         }
         if (card.cardType === 'GROUP_THEME') {
            return 'card-type-crew-com';
         }
         return '';
      })();



      const handleDetailChange = (field: string, value: number | string | Tag | Tag[] | BlandTag[] | null) => {
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



      // ###########################
      // ###   INPUT DEBOUNCER   ###
      // ###########################

      // --- Main Tag ---
      const [localMainTagName, setLocalMainTagName] = useState(details.mainTag.name);

      useEffect(() => {
         const handler = setTimeout(() => {
            if (details.mainTag.name !== localMainTagName) {
               actions.updateCardDetails(card.id, { ...details, mainTag: { ...details.mainTag, name: localMainTagName }});
            }
         }, 500);
         return () => clearTimeout(handler);
      }, [localMainTagName, details, card.id, actions]);

      useEffect(() => {
         setLocalMainTagName(details.mainTag.name);
      }, [details.mainTag.name]);


      // --- Mystery/Identity Text ---
      const mysteryOrIdentity = card.cardType === 'CHARACTER_THEME' ? (details as CityThemeDetails).mystery : (details as CityCrewDetails).identity;
      const [localMystery, setLocalMystery] = useState(mysteryOrIdentity);

      useEffect(() => {
         const handler = setTimeout(() => {
            if (card.cardType === 'CHARACTER_THEME' && (details as CityThemeDetails).mystery !== localMystery) {
               actions.updateCardDetails(card.id, { ...details, mystery: localMystery });
            } else if (card.cardType === 'GROUP_THEME' && (details as CityCrewDetails).identity !== localMystery) {
               actions.updateCardDetails(card.id, { ...details, identity: localMystery });
            }
         }, 500);
         return () => clearTimeout(handler);
      }, [localMystery, details, card.id, card.cardType, actions]);

      useEffect(() => {
         setLocalMystery(mysteryOrIdentity);
      }, [mysteryOrIdentity]);



      const CardFront = (
         <Card className={cn(
            "w-[250px] h-[600px] flex flex-col border-2 shadow-lg p-0 overflow-hidden gap-0",
            "bg-card-paper-bg text-card-paper-fg border-card-border",
            "relative z-0",
            cardTypeClass,
            {"h-[120px] shadow-none pointer-events-none border-2 border-card-border": isDrawerPreview}
         )}>
            <CardHeader className="p-0">
               {card.cardType === 'CHARACTER_THEME' ? (
                  <CardHeaderMolecule
                     title={(details as CityThemeDetails).themebook}
                     type={(details as CityThemeDetails).themeType}
                     className={cn("bg-card-header-bg text-card-header-fg")}
                  />
               ) : (
                  <CardHeaderMolecule title={t('crewThemeTitle')} />
               )}
               <div className="px-2 text-xs font-semibold text-center">
                  <span>{t('power')}</span> • <span className="text-destructive/50">{t('weakness')}</span>
               </div>
            </CardHeader>

            <CardContent className="flex-grow flex flex-col pt-2 px-0 overflow-hidden min-h-0">
               <div className="w-full text-center px-1 py-2.5 flex-shrink-0 flex justify-between items-center gap-2 border-y border-card-accent/30">
                  <div className="w-6">
                     {!isEditing && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => handleDetailChange('mainTag', { ...details.mainTag, isActive: !details.mainTag.isActive })}>
                           {details.mainTag.isActive ? <Disc2 className="h-5 w-5 text-card-paper" /> : <Circle className="h-4 w-4" />}
                        </Button>
                     )}
                  </div>
                  {isEditing ? (
                     <Input
                        className="text-xl font-bold text-center flex-grow border-0 shadow-none"
                        placeholder={t('placeholderName')}
                        value={localMainTagName}
                        onChange={(e) => setLocalMainTagName(e.target.value)}
                     />
                  ) : (
                     <h2 className={cn("text-xl font-bold", details.mainTag.isScratched ? 'line-through opacity-50' : details.mainTag.isActive && 'underline')}>
                        {details.mainTag.name || `[${t('noName')}]`}
                     </h2>
                  )}
                  <div className="w-6">
                     {!isEditing && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 cursor-pointer" onClick={() => handleDetailChange('mainTag', { ...details.mainTag, isScratched: !details.mainTag.isScratched })}>
                           <Flame className={cn('h-4 w-4', details.mainTag.isScratched && 'text-destructive fill-destructive')} />
                        </Button>
                     )}
                  </div>
               </div>
               <div className="flex flex-col flex-grow align-middle overflow-y-auto overscroll-contain" ref={tagsScrollRef}>
                  {details.powerTags.map((tag, index) => <TagItem key={tag.id} cardId={card.id} tag={tag} tagType="power" isEditing={isEditing} index={index} />)}
                  {isEditing && <Button variant="ghost" size="sm" className="m-2 border-1 border-dashed cursor-pointer" onClick={() => actions.addTag(card.id, 'powerTags')}><PlusCircle className="h-4 w-4 mr-2"/>Add Power Tag</Button>}

                  {details.weaknessTags.map((tag, index) => <TagItem key={tag.id} cardId={card.id} tag={tag} tagType="weakness" isEditing={isEditing} index={index} />)}
                  {isEditing && <Button variant="ghost" size="sm" className="m-2 border-1 border-dashed cursor-pointer" onClick={() => actions.addTag(card.id, 'weaknessTags')}><PlusCircle className="h-4 w-4 mr-2"/>Add Weakness Tag</Button>}
               </div>
            </CardContent>

            {!isDrawerPreview &&
               <CardFooter className="p-0 flex flex-col min-h-[37%] max-h-[37%]">
                  <CardSectionHeader title={`${card.cardType === 'GROUP_THEME' ? t('identityTitle') : ((details as CityThemeDetails).themeType === 'Mythos' ? t('mysteryTitle') : t('identityTitle'))}`}></CardSectionHeader>
                  <div className="w-full flex-grow overflow-y-auto overscroll-contain" ref={mysteryScrollRef}>
                     {isEditing ? (
                        <Textarea
                           className="h-full p-0.5 text-xs text-center bg-card-paper-bg/10 border-card-accent/20 resize-none"
                           placeholder={card.cardType === 'GROUP_THEME' ? t('identityPlaceholder') : ((details as CityThemeDetails).themeType === 'Mythos' ? t('mysteryPlaceholder') : t('identityPlaceholder'))}
                           value={localMystery || ''}
                           onChange={(e) => setLocalMystery(e.target.value)}
                        />
                     ) : (
                        <p className="p-2 text-xs text-center whitespace-pre-wrap">{mysteryOrIdentity || `[${card.cardType === 'GROUP_THEME' ? t('noIdentity') : ((details as CityThemeDetails).themeType === 'Mythos' ? t('noMystery') : t('noIdentity'))}]`}</p>
                     )}
                  </div>

                  <div className="flex justify-around items-center py-2 px-2 flex-shrink-0 w-[100%] border-t border-card-accent/30">
                     <PipTracker label={t('attention')} value={details.attention} onUpdate={(val) => handleDetailChange('attention', val)} />
                     {card.cardType === 'GROUP_THEME' ? (
                        <PipTracker label={t('crack')} value={(details as CityCrewDetails).crack} onUpdate={(val) => handleDetailChange('crack', val)} />
                     ) : (
                        <PipTracker label={(details as CityThemeDetails).themeType === 'Mythos' ? t('fade') : t('crack')} value={(details as CityThemeDetails).fadeOrCrack} onUpdate={(val) => handleDetailChange('fadeOrCrack', val)} />
                     )}
                  </div>
               </CardFooter>
            }
         </Card>
      );

      const CardBack = (
         <Card className={cn(
            "w-[250px] h-[600px] flex flex-col border-2 shadow-lg p-0 overflow-hidden gap-0",
            "bg-card-paper-bg text-card-paper-fg border-card-border",
            "relative z-0",
            cardTypeClass,
            {"h-[120px] shadow-none pointer-events-none border-2 border-card-border": isDrawerPreview}
         )}>
            {card.cardType === 'CHARACTER_THEME' ? (
               <CardHeaderMolecule title={(details as CityThemeDetails).themebook} type={(details as CityThemeDetails).themeType} />
            ) : (
               <CardHeaderMolecule title={t('crewThemeTitle')} />
            )}

            <CardSectionHeader title={t('improvements')} />

            <CardContent className="flex-grow flex flex-col p-0 overflow-hidden min-h-0">
               <div className="flex-grow overflow-y-auto space-y-0 p-0 overscroll-contain" ref={improvementsScrollRef}>
                  {details.improvements.map((imp, index) => (
                     <BlandTagItem
                        key={imp.id}
                        cardId={card.id}
                        tag={imp}
                        listName="improvements"
                        isEditing={isEditing}
                        index={index}
                     />
                  ))}
                  {isEditing && (
                     <div className="p-2 w-full">
                        <Button variant="ghost" size="sm" className="w-full border-1 border-dashed cursor-pointer" onClick={() => actions.addBlandTag(card.id, 'improvements')}>
                           <PlusCircle className="h-4 w-4 mr-2" /> {t('addImprovement')}
                        </Button>
                     </div>
                  )}
               </div>
            </CardContent>
         </Card>
      );


      if (effectiveViewMode === 'SIDE_BY_SIDE' && !isDrawerPreview) {
         return (
            <motion.div
               ref={ref}
               onHoverStart={() => setIsHovered(true)}
               onHoverEnd={() => setIsHovered(false)}
               className="relative"
            >
               <ToolbarHandle
                  isEditing={isEditing}
                  isHovered={isHovered}
                  onDelete={() => actions.deleteCard(card.id)}
                  dragAttributes={dragAttributes}
                  dragListeners={dragListeners}
                  cardTheme={cardTypeClass}
                  onEditCard={onEditCard}
                  onExport={onExport}
                  onCycleViewMode={handleCycleViewMode}
                  cardViewMode={card.viewMode}
               />
               <div className="flex gap-1 items-start">
                  {CardFront}
                  {CardBack}
               </div>
            </motion.div>
         );
      }



      return (
         <motion.div
            ref={ref}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            className="relative"
         >
            <motion.div
               className="w-full h-full"
               style={{ transformStyle: 'preserve-3d' }}
               initial={isSnapshot ? { rotateY: card.isFlipped ? 180 : 0 } : { rotateY: 0 }}
               animate={{ rotateY: card.isFlipped ? 180 : 0 }}
               transition={{ duration: 0.5, ease: 'easeInOut' }}
            >

               {!isDrawerPreview &&
                  <ToolbarHandle
                     isEditing={isEditing}
                     isHovered={isHovered}
                     onDelete={() => actions.deleteCard(card.id)}
                     onFlip={() => actions.flipCard(card.id)}
                     dragAttributes={dragAttributes}
                     dragListeners={dragListeners}
                     cardTheme={cardTypeClass}
                     onEditCard={onEditCard}
                     onExport={onExport}
                     onCycleViewMode={handleCycleViewMode}
                     cardViewMode={card.viewMode}
                  />
               }

               {/* ============================================
                                 CARD FRONT
                  ============================================ */}
               <div style={{ backfaceVisibility: 'hidden' }}>
                  {CardFront}
               </div>

               {/* ============================================
                                 CARD BACK
                  ============================================ */}
               <div className="absolute top-0 left-0 w-full h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  {CardBack}
               </div>

            </motion.div>
         </motion.div>
      );
   }
);

CityThemeCard.displayName = 'CityThemeCard';
