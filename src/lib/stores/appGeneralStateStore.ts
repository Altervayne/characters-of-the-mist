// -- Other Library Imports --
import { create } from 'zustand';



type StoreName = 'character' | 'drawer' | 'board';

export type MobileDrawerSnapPoint = 'closed' | 'half' | 'full';

interface AppGeneralState {
   // Undo/Redo Context
   lastModifiedStore: StoreName | null;

   // Command Palette
   isCommandPaletteOpen: boolean;

   // Patch Notes
   isPatchNotesOpen: boolean;
   initialPatchNotesVersion: string | null;

   // Dialogs
   isSettingsOpen: boolean;
   isInfoOpen: boolean;
   isCardDialogOpen: boolean;
   isWelcomeDialogOpen: boolean;
   isLegacyDataDialogOpen: boolean;
   isMobileOnboardingOpen: boolean;
   isMobileTutorialOpen: boolean;

   // App Tour
   isTourOpen: boolean;

   // Edit Mode
   isEditing: boolean;

   // Drawer
   isDrawerOpen: boolean;

   // Mobile Drawer
   mobileDrawerSnapPoint: MobileDrawerSnapPoint;
   
   actions: {
      // Undo/Redo Context
      setLastModifiedStore: (storeName: StoreName) => void;

      // Command Palette
      toggleCommandPalette: () => void;
      setCommandPaletteOpen: (isOpen: boolean) => void;

      // Patch Notes
      setPatchNotesOpen: (isOpen: boolean) => void;
      setInitialPatchNotesVersion: (version: string | null) => void;

      // Dialogs
      setSettingsOpen: (isOpen: boolean) => void;
      setInfoOpen: (isOpen: boolean) => void;
      setCardDialogOpen: (isOpen: boolean) => void;
      setWelcomeDialogOpen: (isOpen: boolean) => void;
      setLegacyDataDialogOpen: (isOpen: boolean) => void;
      setMobileOnboardingOpen: (isOpen: boolean) => void;
      setMobileTutorialOpen: (isOpen: boolean) => void;

      // App Tour
      setTourOpen: (isOpen: boolean) => void;

      // Edit Mode
      setIsEditing: (isEditing: boolean) => void;
      toggleIsEditing: () => void;

      // Drawer
      setDrawerOpen: (isOpen: boolean) => void;
      toggleDrawer: () => void;

      // Mobile Drawer
      setMobileDrawerSnapPoint: (snapPoint: MobileDrawerSnapPoint) => void;
   };
}



export const useAppGeneralStateStore = create<AppGeneralState>((set) => ({
   // Undo/Redo Context
   lastModifiedStore: null,

   // Command Palette
   isCommandPaletteOpen: false,

   // Patch Notes
   isPatchNotesOpen: false,
   initialPatchNotesVersion: null,

   // Dialogs
   isSettingsOpen: false,
   isInfoOpen: false,
   isCardDialogOpen: false,
   isWelcomeDialogOpen: false,
   isLegacyDataDialogOpen: false,
   isMobileOnboardingOpen: false,
   isMobileTutorialOpen: false,

   // App Tour
   isTourOpen: false,

   // Edit Mode
   isEditing: false,

   // Drawer
   isDrawerOpen: false,

   // Mobile Drawer
   mobileDrawerSnapPoint: 'closed',

   actions: {
      // Undo/Redo Context
      setLastModifiedStore: (storeName) => set({ lastModifiedStore: storeName }),

      // Command Palette
      toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
      setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),

      // Patch Notes
      setPatchNotesOpen: (isOpen) => set({ isPatchNotesOpen: isOpen }),
      setInitialPatchNotesVersion: (version) => set({ initialPatchNotesVersion: version }),

      // Dialogs
      setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setInfoOpen: (isOpen) => set({ isInfoOpen: isOpen }),
      setCardDialogOpen: (isOpen) => set({ isCardDialogOpen: isOpen }),
      setWelcomeDialogOpen: (isOpen) => set({ isWelcomeDialogOpen: isOpen }),
      setLegacyDataDialogOpen: (isOpen) => set({ isLegacyDataDialogOpen: isOpen }),
      setMobileOnboardingOpen: (isOpen) => set({ isMobileOnboardingOpen: isOpen }),
      setMobileTutorialOpen: (isOpen) => set({ isMobileTutorialOpen: isOpen }),

      // App Tour
      setTourOpen: (isOpen) => set({ isTourOpen: isOpen }),

      // Edit Mode
      setIsEditing: (isEditing) => set({ isEditing }),
      toggleIsEditing: () => set((state) => ({ isEditing: !state.isEditing })),

      // Drawer
      setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      // Mobile Drawer
      setMobileDrawerSnapPoint: (snapPoint) => set({ mobileDrawerSnapPoint: snapPoint }),
   },
}));



export const useAppGeneralStateActions = () => useAppGeneralStateStore((state) => state.actions);