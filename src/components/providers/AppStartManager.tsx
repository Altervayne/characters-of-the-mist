// -- React Imports --
import React, { useState, useEffect, startTransition } from 'react';

// -- Other Library Imports --
import { gt as isVersionGreaterThan } from 'semver';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

// -- Utils Imports --
import { APP_VERSION } from '@/lib/config';
import { patchNotes } from '@/lib/patch-notes';

// -- Component Imports --
import { LocalStorageError } from '../molecules/LocalStorageError';
import { LegacyDataDialog } from '@/components/organisms/dialogs/LegacyDataDialog';
import { PatchNotesDialog } from '@/components/organisms/dialogs/PatchNotesDialog';
import { WelcomeDialog } from '@/components/organisms/dialogs/WelcomeDialog';
import MobileOnboarding from '@/components/mobile/onboarding/MobileOnboarding';
import { MigrationNoticeDialog } from '@/components/organisms/dialogs/MigrationNoticeDialog';

// -- Store and Hook Imports --
import { useAppGeneralStateStore, useAppGeneralStateActions } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsActions, useAppSettingsStore } from '@/lib/stores/appSettingsStore';
import { useAppTourDriver } from '@/hooks/useAppTourDriver';
import { useDeviceType } from '@/hooks/useDeviceType';

// -- Migrations --
import { runDrawerMigrationIfNeeded } from '@/lib/drawer/runDrawerMigration';
import { runCharacterMigrationIfNeeded } from '@/lib/character/runCharacterMigration';

// -- Character Persistence --
import { startCharacterPersistence, runCharacterBoot } from '@/lib/character/characterPersistence';
import { ensureSingleActiveInstance } from '@/lib/character/characterStoreRegistry';



type DialogStep = 'legacy' | 'welcome' | 'mobileOnboarding' | 'patchNotes' | null;

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
   const [showMigrationNotice, setShowMigrationNotice] = useState(false);

   const { t } = useTranslation();
   const { isMobile } = useDeviceType();

   const isLegacyDataDialogOpen = useAppGeneralStateStore((state) => state.isLegacyDataDialogOpen);
   const isWelcomeDialogOpen = useAppGeneralStateStore((state) => state.isWelcomeDialogOpen);
   const isPatchNotesOpen = useAppGeneralStateStore((state) => state.isPatchNotesOpen);
   const isMobileOnboardingOpen = useAppGeneralStateStore((state) => state.isMobileOnboardingOpen);
   const { setLegacyDataDialogOpen, setWelcomeDialogOpen, setPatchNotesOpen, setInitialPatchNotesVersion, setSettingsOpen, setDrawerOpen, setMobileOnboardingOpen, setMobileTutorialOpen } = useAppGeneralStateActions();
   const { setSidebarCollapsed } = useAppSettingsActions();
   const { startTour } = useAppTourDriver();



   // ==================
   //  IndexedDB migrations + character boot (one-time)
   // ==================
   // Copies the legacy localStorage drawer blob into Dexie exactly once. Runs in
   // the background and never blocks startup; a failure surfaces as a non-blocking
   // toast and the migration retries on the next load. The call is self-guarded
   // and de-duplicates StrictMode's double mount.
   //
   // The character is now sourced from IndexedDB (spec §5): attach the save
   // subscription, then, after the one-time character migration, read the session
   // pointer and load the active character. The boot loading gate (set inside
   // runCharacterBoot) keeps first paint on a neutral loading screen until this
   // resolves, so the main menu never flashes before the sheet appears.
   useEffect(() => {
      // Ensure the single active character instance exists before persistence
      // attaches or boot loads into it, independent of component render order
      // (tabs spec §6). Idempotent: the registry returns the same instance.
      ensureSingleActiveInstance();
      startCharacterPersistence();

      // Drawer migration runs concurrently and never blocks the boot critical path
      // (only the character load gates first paint). We keep its outcome to decide
      // the one-time upgrade notice below.
      const drawerMigration = runDrawerMigrationIfNeeded().catch(() => {
         toast.error(t('Notifications.drawer.storageUpgradeFailed'));
         return 'error' as const;
      });

      void (async () => {
         let characterMigrated = false;
         try {
            characterMigrated = (await runCharacterMigrationIfNeeded()) === 'migrated';
         } catch (error) {
            // The migration sets the session pointer and writes the record before
            // its verify step, so even a verification failure leaves a usable
            // character to boot into; log and continue rather than block startup.
            console.error('Character IndexedDB migration failed (will retry next load):', error);
         }
         await runCharacterBoot();

         // One-time transparency notice: shown only when data was actually moved
         // this load (each migration returns 'migrated' exactly once, so the notice
         // never repeats). Awaiting the drawer promise here, AFTER boot, keeps the
         // drawer migration off the first-paint critical path while still gating the
         // notice on both domains.
         const drawerMigrated = (await drawerMigration) === 'migrated';
         if (characterMigrated || drawerMigrated) {
            startTransition(() => setShowMigrationNotice(true));
         }
      })();
   }, [t]);

   // ==================
   //  Dialog queue generator and handler
   // ==================
   useEffect(() => {
      if (didInit) return;
      if (!isLocalStorageAvailable()) return;

      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      const hasVisited = localStorage.getItem(WELCOME_KEY);
      const appSettings = useAppSettingsStore.getState();
      const lastVisitedVersion = appSettings.lastVisitedVersion;

      const willShowLegacy = !!legacyData;
      const willShowWelcome = !hasVisited;
      const willShowPatchNotes = !willShowWelcome && isVersionGreaterThan(APP_VERSION, lastVisitedVersion);

      startTransition(() => {
         setShouldShowWelcome(willShowWelcome);
         setShouldShowPatchNotes(willShowPatchNotes);

         if (willShowLegacy) {
            setCurrentDialog('legacy');
         } else if (willShowWelcome) {
            // Show mobile onboarding on mobile, desktop welcome dialog otherwise
            setCurrentDialog(isMobile ? 'mobileOnboarding' : 'welcome');
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
      });

      appSettings.actions.setLastVisitedVersion(APP_VERSION);

      startTransition(() => {
         setDidInit(true);
      });
   }, [didInit]);

   useEffect(() => {
      switch (currentDialog) {
         case 'legacy':
            setLegacyDataDialogOpen(true);
            break;
         case 'welcome':
            setLegacyDataDialogOpen(false);
            setWelcomeDialogOpen(true);
            break;
         case 'mobileOnboarding':
            setLegacyDataDialogOpen(false);
            setMobileOnboardingOpen(true);
            break;
         case 'patchNotes':
            setLegacyDataDialogOpen(false);
            setPatchNotesOpen(true);
            break;
         default:
            break;
      }
   }, [currentDialog]);

   

   // ==================
   //  Dialog closing handler
   // ==================
   const handleDialogClose = () => {
      if (currentDialog === 'welcome' || currentDialog === 'mobileOnboarding') {
         localStorage.setItem(WELCOME_KEY, 'true');
      }

      if (!isStartupFlow) {
         if (isLegacyDataDialogOpen) setLegacyDataDialogOpen(false);
         if (isWelcomeDialogOpen) setWelcomeDialogOpen(false);
         if (isMobileOnboardingOpen) setMobileOnboardingOpen(false);
         if (isPatchNotesOpen) setPatchNotesOpen(false);
         setCurrentDialog(null);
         return;
      }

      if (currentDialog === 'legacy' && shouldShowWelcome) {
         setCurrentDialog(isMobile ? 'mobileOnboarding' : 'welcome');
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
      } else if (currentDialog === 'mobileOnboarding') {
         setMobileOnboardingOpen(false);
         setIsStartupFlow(false);
      } else if (currentDialog === 'patchNotes') {
         setPatchNotesOpen(false);
         setIsStartupFlow(false);
      }
   };

   // ==================
   //  Mobile onboarding completion handler
   // ==================
   const handleMobileOnboardingComplete = (startTutorial: boolean) => {
      localStorage.setItem(WELCOME_KEY, 'true');
      setMobileOnboardingOpen(false);
      setIsStartupFlow(false);
      setCurrentDialog(null);

      if (startTutorial) {
         // Small delay to allow onboarding to close before starting tutorial
         setTimeout(() => {
            setMobileTutorialOpen(true);
         }, 300);
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
         <MobileOnboarding
            isOpen={isMobileOnboardingOpen}
            onComplete={handleMobileOnboardingComplete}
         />
         <MigrationNoticeDialog
            isOpen={showMigrationNotice}
            onClose={() => setShowMigrationNotice(false)}
         />
      </>
   );
};