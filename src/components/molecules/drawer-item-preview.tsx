'use client';

// -- React Imports --
import React from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Icon Imports --
import { Folder, GripVertical } from 'lucide-react';

// -- Component Imports --
import { LegendsThemeCard } from '@/components/organisms/legends-theme-card';
import { CityThemeCard } from '@/components/organisms/city-theme-card';
import { OtherscapeThemeCard } from '@/components/organisms/otherscape-theme-card';
import { HeroCard } from '@/components/organisms/hero-card';
import { RiftCard } from '@/components/organisms/rift-card';
import { OtherscapeCharacterCard } from '@/components/organisms/otherscape-character-card';
import { StatusTrackerCard } from '@/components/molecules/status-tracker';
import { StoryTagTrackerCard } from '@/components/molecules/story-tag-tracker';
import { CharacterSheetPreview } from '@/components/molecules/character-sheet-preview';

// -- Type Imports --
import { DrawerItem, Folder as FolderType } from '@/lib/types/drawer';
import { StoryThemeTrackerCard } from '../organisms/story-theme-tracker';



export function FolderPreview({ folder }: { folder: FolderType }) {
   return (
      <div
            className="flex items-center justify-between gap-2 py-1 pl-1 pr-2 rounded bg-popover/50 border-2 border-border"
         >
         <div
            className="flex h-8 items-center gap-2 truncate "
         >
            <GripVertical
               className="h-5 w-5 flex-shrink-0 text-accent-foreground cursor-grab"
            />
            <Folder className="h-6 w-6 flex-shrink-0 text-accent-foreground"/>
            <span className="truncate font-medium text-sm">{folder.name}</span>
         </div>
      </div>
   );
}

export function DrawerItemPreview({ item }: { item: DrawerItem }) {
   const t = useTranslations('Drawer.Types');

   const renderSnapshot = () => {
      const { content, type, game } = item;

      if (game === 'LEGENDS') {
         if ('cardType' in content) {
            switch (type) {
            case 'CHARACTER_THEME':
            case 'GROUP_THEME':
               return <LegendsThemeCard card={content} isDrawerPreview />;
            case 'CHARACTER_CARD':
               return <HeroCard card={content} isDrawerPreview />;
            }
         }

         if ('trackerType' in content) {
            if (content.trackerType === 'STATUS') {
               return <StatusTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_TAG') {
               return <StoryTagTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_THEME') {
               return <StoryThemeTrackerCard tracker={content} isDrawerPreview />;
            }
         }

         if (type === 'FULL_CHARACTER_SHEET') {
            return <CharacterSheetPreview item={item} />;
         }
      }

      if (game === 'CITY_OF_MIST') {
         if ('cardType' in content) {
            switch (type) {
            case 'CHARACTER_THEME':
            case 'GROUP_THEME':
               return <CityThemeCard card={content} isDrawerPreview />;
            case 'CHARACTER_CARD':
               return <RiftCard card={content} isDrawerPreview />;
            }
         }

         if ('trackerType' in content) {
            if (content.trackerType === 'STATUS') {
               return <StatusTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_TAG') {
               return <StoryTagTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_THEME') {
               return <StoryThemeTrackerCard tracker={content} isDrawerPreview />;
            }
         }

         if (type === 'FULL_CHARACTER_SHEET') {
            return <CharacterSheetPreview item={item} />;
         }
      }

      if (game === 'OTHERSCAPE') {
         if ('cardType' in content) {
            switch (type) {
            case 'CHARACTER_THEME':
            case 'GROUP_THEME':
            case 'LOADOUT_THEME':
               return <OtherscapeThemeCard card={content} isDrawerPreview />;
            case 'CHARACTER_CARD':
               return <OtherscapeCharacterCard card={content} isDrawerPreview />;
            }
         }

         if ('trackerType' in content) {
            if (content.trackerType === 'STATUS') {
               return <StatusTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_TAG') {
               return <StoryTagTrackerCard tracker={content} isDrawerPreview />;
            }
            if (content.trackerType === 'STORY_THEME') {
               return <StoryThemeTrackerCard tracker={content} isDrawerPreview />;
            }
         }

         if (type === 'FULL_CHARACTER_SHEET') {
            return <CharacterSheetPreview item={item} />;
         }
      }

      return (
         <div className="w-[250px] h-[100px] flex items-center justify-center bg-popover/50 text-muted-foreground rounded-lg p-4 text-center">
               <p className="text-xs">{t('unavailablePreview')}</p>
         </div>
      );
   };

   return (
      <div className="p-2 rounded-md hover:bg-muted transition-colors bg-card/75 border-2 border-border">
         <p className="font-semibold truncate text-md mb-2 px-1">
            {item.name}
         </p>

         <div className="w-full h-[120px] my-4 flex items-center justify-center bg-transparent pointer-events-none rounded-md overflow-hidden">
            <div>
               {renderSnapshot()}
            </div>
         </div>

         <p className="w-full text-center font-semibold truncate text-sm mb-2 px-1">
            <span>{t(item.game)}</span> • <span>{t(`${item.game}_${item.type}`)}</span>
         </p>
      </div>
   );
};