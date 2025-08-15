// src/components/organisms/MainMenu.tsx
'use client';

import React from 'react';

// -- Basic UI Imports --
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

// -- Icon Imports --
import { Sparkles } from 'lucide-react';

// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useCharacterActions } from '@/lib/stores/characterStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { GameSystem } from '@/lib/types/drawer';

const MainMenu: React.FC = () => {
   const { contextualGame } = useAppSettingsStore();
   const { createCharacter } = useCharacterActions();
   const { setContextualGame } = useAppSettingsActions();

   const handleCreateCharacter = () => {
      createCharacter(contextualGame);
   };

   const handleGameSelect = (game: GameSystem) => {
      if (game) {
         setContextualGame(game);
      }
   };



   return (
      <section className="flex h-full w-full flex-col items-center justify-center">
         <div className="flex flex-col items-center gap-8 rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
            <div className="flex flex-col items-center gap-2">
               <Sparkles className="h-12 w-12 text-muted-foreground" />
               <h1 className="text-2xl font-bold tracking-tight">Character Manager</h1>
               <p className="text-sm text-muted-foreground">
                  Select a game system to begin
               </p>
            </div>

            <Separator />

            <div className="flex flex-col items-center gap-4">
               <h2 className="font-semibold">Game System</h2>
               <ToggleGroup
                  type="single"
                  value={contextualGame}
                  onValueChange={handleGameSelect}
                  className="justify-center"
               >
                  <ToggleGroupItem value="LEGENDS" aria-label="Select Legends">
                     Legends in the Mist
                  </ToggleGroupItem>
                  <ToggleGroupItem value="CITY_OF_MIST" aria-label="Select City of Mist">
                     City of Mist
                  </ToggleGroupItem>
                  <ToggleGroupItem value="OTHERSCAPE" aria-label="Select Otherscape">
                     Metro: Otherscape
                  </ToggleGroupItem>
               </ToggleGroup>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
               <Button onClick={handleCreateCharacter} size="lg" className="cursor-pointer">
                  Create New Character
               </Button>
               <Button variant="outline" size="lg" className="cursor-pointer" disabled>
                  Load from Drawer
               </Button>
            </div>
         </div>
      </section>
   );
};

export default MainMenu;