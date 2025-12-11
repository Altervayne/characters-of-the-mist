// src/components/organisms/MainMenu.tsx
'use client';

import React from 'react';

// -- Next Imports --
import { useTranslations } from 'next-intl';

// -- Other Library Imports --
import { motion } from 'framer-motion';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';

// -- Icon Imports --
import { Sparkles, ScrollText, Building2, Bot, Plus, FolderOpen } from 'lucide-react';

// -- Utils Imports --
import { cn } from '@/lib/utils';

// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/drawer';



interface GameCardProps {
   title: string;
   subtitle: string;
   icon: React.ReactNode;
   isSelected: boolean;
   onClick: () => void;
   gradient: string;
}



const GameCard: React.FC<GameCardProps> = ({ title, subtitle, icon, isSelected, onClick, gradient }) => {
   return (
      <motion.button
         onClick={onClick}
         className={cn(
            "relative overflow-hidden rounded-xl p-6 w-72 h-48 text-left transition-all cursor-pointer",
            "border-2 bg-card hover:shadow-xl",
            isSelected
               ? "border-primary shadow-lg ring-4 ring-primary/20"
               : "border-border hover:border-primary/50"
         )}
      >
         <div className={cn(
            "absolute inset-0 opacity-10 transition-opacity",
            isSelected && "opacity-20",
            gradient
         )} />

         <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between">
               <div className="p-3 rounded-lg bg-background/50 backdrop-blur-sm">
                  {icon}
               </div>
               {isSelected && (
                  <motion.div
                     initial={{ scale: 0, rotate: -180 }}
                     animate={{ scale: 1, rotate: 0 }}
                     className="p-1.5 rounded-full bg-primary text-primary-foreground"
                  >
                     <Sparkles className="h-4 w-4" />
                  </motion.div>
               )}
            </div>

            <div>
               <h3 className="text-xl font-bold text-foreground mb-1">{title}</h3>
               <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
         </div>
      </motion.button>
   );
};



const MainMenu: React.FC = () => {
   const t = useTranslations('MainMenu');
   const { contextualGame } = useAppSettingsStore();
   const { createCharacter } = useCharacterActions();
   const { setContextualGame } = useAppSettingsActions();
   const { setDrawerOpen } = useAppGeneralStateActions();

   const handleCreateCharacter = () => {
      createCharacter(contextualGame);
   };

   const handleGameSelect = (game: GameSystem) => {
      setContextualGame(game);
   };

   const handleOpenDrawer = () => {
      setDrawerOpen(true);
   };

   const gameOptions = [
      {
         game: 'LEGENDS' as GameSystem,
         title: t('games.legends.title'),
         subtitle: t('games.legends.subtitle'),
         icon: <ScrollText className="h-6 w-6 text-amber-500" />,
         gradient: 'bg-gradient-to-br from-amber-500 via-orange-400 to-rose-500'
      },
      {
         game: 'CITY_OF_MIST' as GameSystem,
         title: t('games.cityOfMist.title'),
         subtitle: t('games.cityOfMist.subtitle'),
         icon: <Building2 className="h-6 w-6 text-purple-500" />,
         gradient: 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600'
      },
      {
         game: 'OTHERSCAPE' as GameSystem,
         title: t('games.otherscape.title'),
         subtitle: t('games.otherscape.subtitle'),
         icon: <Bot className="h-6 w-6 text-cyan-500" />,
         gradient: 'bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600'
      }
   ];

   return (
      <main className="absolute flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
         {/* Wave/Mist Background Layers */}
         <div className="absolute inset-0 pointer-events-none">
            {/* Wave Layer 1 - Bottom */}
            <motion.div
               className="absolute bottom-0 left-0 right-0 h-96 opacity-10"
               initial={{ x: 0 }}
               animate={{ x: [-20, 20, -20] }}
               transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            >
               <svg className="absolute bottom-0 w-[110%] h-full -left-[5%]" preserveAspectRatio="none" viewBox="0 0 1200 120">
                  <path
                     d="M0,50 C300,80 400,20 600,50 C800,80 900,20 1200,50 L1200,120 L0,120 Z"
                     fill="currentColor"
                     className="text-muted"
                  />
               </svg>
            </motion.div>

            {/* Wave Layer 2 - Middle */}
            <motion.div
               className="absolute bottom-0 left-0 right-0 h-80 opacity-8"
               initial={{ x: 0 }}
               animate={{ x: [20, -20, 20] }}
               transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            >
               <svg className="absolute bottom-0 w-[110%] h-full -left-[5%]" preserveAspectRatio="none" viewBox="0 0 1200 120">
                  <path
                     d="M0,60 C250,90 450,30 650,60 C850,90 1000,30 1200,60 L1200,120 L0,120 Z"
                     fill="currentColor"
                     className="text-muted/70"
                  />
               </svg>
            </motion.div>

            {/* Wave Layer 3 - Top */}
            <motion.div
               className="absolute bottom-0 left-0 right-0 h-64 opacity-6"
               initial={{ x: 0 }}
               animate={{ x: [-15, 15, -15] }}
               transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            >
               <svg className="absolute bottom-0 w-[110%] h-full -left-[5%]" preserveAspectRatio="none" viewBox="0 0 1200 120">
                  <path
                     d="M0,70 C200,100 500,40 700,70 C900,100 1050,40 1200,70 L1200,120 L0,120 Z"
                     fill="currentColor"
                     className="text-muted/50"
                  />
               </svg>
            </motion.div>
         </div>

         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-10 p-8 max-w-6xl w-full relative z-10"
         >
            {/* Header */}
            <div className="flex flex-col items-center gap-3 text-center">
               <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="p-4 rounded-2xl bg-primary/10"
               >
                  <Sparkles className="h-12 w-12 text-primary" />
               </motion.div>
               <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  {t('title')}
               </h1>
               <p className="text-muted-foreground max-w-md">
                  {t('subtitle')}
               </p>
            </div>

            {/* Game Selection Cards */}
            <div className="flex flex-wrap justify-center gap-6">
               {gameOptions.map((option, index) => (
                  <motion.div
                     key={option.game}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: 0.1 * (index + 1) }}
                  >
                     <GameCard
                        {...option}
                        isSelected={contextualGame === option.game}
                        onClick={() => handleGameSelect(option.game)}
                     />
                  </motion.div>
               ))}
            </div>

            {/* Action Buttons */}
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.5 }}
               className="flex flex-col sm:flex-row gap-4"
            >
               <Button
                  onClick={handleCreateCharacter}
                  size="lg"
                  className="cursor-pointer gap-2 px-8 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
               >
                  <Plus className="h-5 w-5" />
                  {t('createButton')}
               </Button>
               <Button
                  onClick={handleOpenDrawer}
                  variant="outline"
                  size="lg"
                  className="cursor-pointer gap-2 px-8 h-12 text-base font-semibold border-2 hover:bg-accent/50 transition-all"
               >
                  <FolderOpen className="h-5 w-5" />
                  {t('openDrawerButton')}
               </Button>
            </motion.div>

            {/* Footer hint */}
            <motion.p
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.7 }}
               className="text-xs text-muted-foreground/70 text-center"
            >
               {t('hint')}
            </motion.p>
         </motion.div>
      </main>
   );
};

export default MainMenu;