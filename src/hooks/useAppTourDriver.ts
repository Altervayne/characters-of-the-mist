'use client';

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { driver } from 'driver.js';

// -- Utils Imports --
import { getTourSteps } from '@/lib/driver-tour';

// -- Store and Hook Imports --
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useCharacterActions } from '@/lib/stores/characterStore';



export const useAppTourDriver = () => {
   const { t: t } = useTranslation();
   const { setTourOpen, setIsEditing, setDrawerOpen } = useAppGeneralStateActions();
   const { setContextualGame } = useAppSettingsActions();
   const { createCharacter } = useCharacterActions();

   const startTour = () => {
      const driverObj = driver({
         popoverClass: 'cotm-driver',
         showProgress: true,
         progressText: "{{current}} / {{total}}",
         disableActiveInteraction: true,
         onDestroyStarted: () => {
            setTourOpen(false);
            setIsEditing(false);
            setDrawerOpen(false);
            driverObj.destroy();
         },
         steps: getTourSteps(t, { setIsEditing, setDrawerOpen, setContextualGame, createCharacter }),
      });

      driverObj.drive();
      setTourOpen(true);
   };

   return { startTour };
};