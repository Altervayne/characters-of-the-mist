'use client';

// -- React Imports --
import React, { useState, useEffect } from 'react';

// -- Other Library Imports --
import { gt as isVersionGreaterThan } from 'semver';

// -- Utils Imports --
import { APP_VERSION } from '@/lib/config';
import { patchNotes } from '@/lib/patch-notes';

// -- Component Imports --
import { LocalStorageError } from '../molecules/local-storage-error';
import { LegacyDataDialog } from '../organisms/legacy-data-dialog';
import { PatchNotesDialog } from '@/components/organisms/patch-notes-dialog';
import { WelcomeDialog } from '@/components/organisms/welcome-dialog';

// -- Store and Hook Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppTourDriver } from '@/hooks/useAppTourDriver';
import { usePathname, useRouter } from 'next/navigation';



type DialogStep = 'legacy' | 'welcome' | 'patchNotes' | null;

const WELCOME_KEY = 'characters-of-the-mist_has-visited';
const LEGACY_STORAGE_KEY = 'characterData';

const isLocalStorageAvailable = (): boolean => {
   try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
   } catch {
      return false;
   }
};



export const AppStartManagerProvider = ({ children }: { children: React.ReactNode }) => {
   const [currentDialog, setCurrentDialog] = useState<DialogStep>(null);
   const [isStartupFlow, setIsStartupFlow] = useState(true);
   const [shouldShowWelcome, setShouldShowWelcome] = useState(false);
   const [shouldShowPatchNotes, setShouldShowPatchNotes] = useState(false);
   const [didInit, setDidInit] = useState(false);

   const isLegacyDataDialogOpen = useAppGeneralStateStore((state) => state.isLegacyDataDialogOpen);
   const isWelcomeDialogOpen = useAppGeneralStateStore((state) => state.isWelcomeDialogOpen);
   const isPatchNotesOpen = useAppGeneralStateStore((state) => state.isPatchNotesOpen);
   const { setLegacyDataDialogOpen, setWelcomeDialogOpen, setPatchNotesOpen, setInitialPatchNotesVersion, setSettingsOpen, setDrawerOpen } = useAppGeneralStateActions();
   const { setSidebarCollapsed } = useAppSettingsActions();
   const { startTour } = useAppTourDriver();



   // --- Client check ---
   const [isClient, setIsClient] = useState(false);

   useEffect(() => {
      setIsClient(true);
   }, []);



   // --- Dialog queue generator and handler ---
   useEffect(() => {
      if (!isClient || didInit) return;
      if (!isLocalStorageAvailable()) return;

      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      const hasVisited = localStorage.getItem(WELCOME_KEY);
      const appSettings = useAppSettingsStore.getState();
      const lastVisitedVersion = appSettings.lastVisitedVersion;

      const willShowLegacy = !!legacyData;
      const willShowWelcome = !hasVisited;
      const willShowPatchNotes = !willShowWelcome && isVersionGreaterThan(APP_VERSION, lastVisitedVersion);

      setShouldShowWelcome(willShowWelcome);
      setShouldShowPatchNotes(willShowPatchNotes);

      if (willShowLegacy) {
         setCurrentDialog('legacy');
      } else if (willShowWelcome) {
         setCurrentDialog('welcome');
      } else if (willShowPatchNotes) {
         let firstUnreadIndex = 0;
         
         for (let i = patchNotes.length - 1; i >= 0; i--) {
            if (isVersionGreaterThan(patchNotes[i].version, lastVisitedVersion)) {
               firstUnreadIndex = i;
               break;
            }
         }

         const firstUnreadVersion = patchNotes[firstUnreadIndex]?.version || patchNotes[0]?.version;
         setInitialPatchNotesVersion(firstUnreadVersion);
         setCurrentDialog('patchNotes');
      } else {
         setIsStartupFlow(false)
         setCurrentDialog(null)
      }

      appSettings.actions.setLastVisitedVersion(APP_VERSION);
      setDidInit(true);
   }, [isClient, didInit]);

   useEffect(() => {
      switch (currentDialog) {
         case 'legacy':
            setLegacyDataDialogOpen(true);
            break;
         case 'welcome':
            setLegacyDataDialogOpen(false);
            setWelcomeDialogOpen(true);
            break;
         case 'patchNotes':
            setLegacyDataDialogOpen(false);
            setPatchNotesOpen(true);
            break;
         default:
            break;
      }
   }, [currentDialog]);

   

   // --- Dialog closing handler ---
   const handleDialogClose = () => {
      if (currentDialog === 'welcome') {
         localStorage.setItem(WELCOME_KEY, 'true');
      }

      if (!isStartupFlow) {
         if (isLegacyDataDialogOpen) setLegacyDataDialogOpen(false);
         if (isWelcomeDialogOpen) setWelcomeDialogOpen(false);
         if (isPatchNotesOpen) setPatchNotesOpen(false);
         setCurrentDialog(null);
         return;
      }

      if (currentDialog === 'legacy' && shouldShowWelcome) {
         setCurrentDialog('welcome');
         setShouldShowWelcome(false);
         return;
      }

      if (currentDialog === 'legacy' && shouldShowPatchNotes) {
         setCurrentDialog('patchNotes');
         setShouldShowPatchNotes(false);
         return;
      }

      if (currentDialog === 'welcome') {
         setWelcomeDialogOpen(false);
         setIsStartupFlow(false);
      } else if (currentDialog === 'patchNotes') {
         setPatchNotesOpen(false);
         setIsStartupFlow(false);
      }
   };



   const handleStartTour = () => {
      setSidebarCollapsed(false);
      setSettingsOpen(false);
      setDrawerOpen(false);
      startTour();
   };

   const handleOpenPatchNotesFromWelcome = () => {
      setCurrentDialog('patchNotes');
      setWelcomeDialogOpen(false);
      setPatchNotesOpen(true);
      setIsStartupFlow(false);
   }



   if (!isClient) return null;

   if (!isLocalStorageAvailable) {
      return <LocalStorageError />;
   }



   return (
      <>
         {children}
         <LegacyDataDialog 
            isOpen={isLegacyDataDialogOpen} 
            onOpenChange={(open) => {
               if (!open) handleDialogClose();
            }} 
         />
         <WelcomeDialog
            isOpen={isWelcomeDialogOpen}
            onOpenChange={(open) => {
               if (!open) handleDialogClose();
            }}
            onStartTutorial={handleStartTour}
            onShowPatchNotes={handleOpenPatchNotesFromWelcome}
         />
         <PatchNotesDialog 
            isOpen={isPatchNotesOpen} 
            onOpenChange={(open) => {
               if (!open) handleDialogClose();
            }} 
         />
      </>
   );
};