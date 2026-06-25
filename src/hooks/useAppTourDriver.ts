

// -- Next Imports --
import { useTranslation } from 'react-i18next';

// -- Other Library Imports --
import { driver } from 'driver.js';

// -- Utils Imports --
import { getTourSteps } from '@/lib/driver-tour';

// -- Store and Hook Imports --
import { useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useTabManagerActions } from '@/lib/character/tabManagerStore';



export const useAppTourDriver = () => {
   const { t: t } = useTranslation();
   const { setTourOpen, setIsEditing, setDrawerOpen } = useAppGeneralStateActions();
   // Still routed to the menu before the tour: the opening step is element-less, and the sheet steps
   // need a character open, but the MainMenu intro steps themselves were dropped in the chooser revamp.
   const { deactivate } = useTabManagerActions();

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
         steps: getTourSteps(t, { setIsEditing, setDrawerOpen }),
      });

      driverObj.drive();
      setTourOpen(true);
   };

   return { startTour };
};