

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { driver } from 'driver.js';

// -- Utils Imports --
import { getTourSteps } from '@/lib/driver-tour';

// -- Store and Hook Imports --
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';



export const useAppTourDriver = () => {
   const { t: t } = useTranslation();
   const { setTourOpen, setIsEditing, setDrawerOpen } = useAppGeneralStateActions();
   const { setContextualGame } = useAppSettingsActions();
   // The tour's "create a character" step routes through the TabManager so the demo
   // character becomes a real id-keyed instance + tab (not loaded into the menu
   // fallback). getTourSteps still receives it under the `createCharacter` key.
   const { createCharacterTab, deactivate } = useTabManagerActions();

   const startTour = () => {
      // The opening steps anchor to main-menu-only DOM, so a restart from inside a
      // sheet must return to the menu first. deactivate() switches to the menu view
      // without closing any tabs; the element-less welcome step covers the render tick.
      deactivate();

      const driverObj = driver({
         popoverClass: 'cotm-driver',
         showProgress: true,
         progressText: "{{current}} / {{total}}",
         disableActiveInteraction: true,
         smoothScroll: true,
         stagePadding: 12,
         onDestroyStarted: () => {
            setTourOpen(false);
            setIsEditing(false);
            setDrawerOpen(false);
            driverObj.destroy();
         },
         steps: getTourSteps(t, { setIsEditing, setDrawerOpen, setContextualGame, createCharacter: createCharacterTab }),
      });

      driverObj.drive();
      setTourOpen(true);
   };

   return { startTour };
};