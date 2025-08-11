// -- Other Library Imports --
import { create } from 'zustand';



type StoreName = 'character' | 'drawer';



interface AppGeneralState {
   // --- Undo/Redo Context ---
   lastModifiedStore: StoreName | null;

   // --- Command Palette ---
   isCommandPaletteOpen: boolean;

   // --- Patch Notes ---
   isPatchNotesOpen: boolean;
   initialPatchNotesVersion: string | null;

   // --- Dialogs ---
   isSettingsOpen: boolean;
   isInfoOpen: boolean;
   isCardDialogOpen: boolean;
   isWelcomeDialogOpen: boolean;
   isLegacyDataDialogOpen: boolean;

   // --- App Tour ---
   isTourOpen: boolean;

   // --- Sidebar ---
   isSidebarCollapsed: boolean;

   // --- Edit Mode ---
   isEditing: boolean;

   // --- Drawer ---
   isDrawerOpen: boolean;
   
   actions: {
      // --- Undo/Redo Context ---
      setLastModifiedStore: (storeName: StoreName) => void;

      // --- Command Palette ---
      toggleCommandPalette: () => void;
      setCommandPaletteOpen: (isOpen: boolean) => void;

      // --- Patch Notes ---
      setPatchNotesOpen: (isOpen: boolean) => void;
      setInitialPatchNotesVersion: (version: string | null) => void;

      // --- Dialogs ---
      setSettingsOpen: (isOpen: boolean) => void;
      setInfoOpen: (isOpen: boolean) => void;
      setCardDialogOpen: (isOpen: boolean) => void;
      setWelcomeDialogOpen: (isOpen: boolean) => void;
      setLegacyDataDialogOpen: (isOpen: boolean) => void;

      // --- App Tour ---
      setTourOpen: (isOpen: boolean) => void;

      // --- Sidebar ---
      setSidebarCollapsed: (isCollapsed: boolean) => void;
      toggleSidebarCollapsed: () => void;

      // --- Edit Mode ---
      setIsEditing: (isEditing: boolean) => void;
      toggleIsEditing: () => void;

      // --- Drawer ---
      setDrawerOpen: (isOpen: boolean) => void;
      toggleDrawer: () => void;
   };
}



export const useAppGeneralStateStore = create<AppGeneralState>((set) => ({
   // --- Undo/Redo Context ---
   lastModifiedStore: null,

   // --- Command Palette ---
   isCommandPaletteOpen: false,

   // --- Patch Notes ---
   isPatchNotesOpen: false,
   initialPatchNotesVersion: null,

   // --- Dialogs ---
   isSettingsOpen: false,
   isInfoOpen: false,
   isCardDialogOpen: false,
   isWelcomeDialogOpen: false,
   isLegacyDataDialogOpen: false,

   // --- App Tour ---
   isTourOpen: false,

   // --- Sidebar ---
   isSidebarCollapsed: false,

   // --- Edit Mode ---
   isEditing: false,

   // --- Drawer ---
   isDrawerOpen: false,

   actions: {
      // --- Undo/Redo Context ---
      setLastModifiedStore: (storeName) => set({ lastModifiedStore: storeName }),

      // --- Command Palette ---
      toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
      setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),

      // --- Patch Notes ---
      setPatchNotesOpen: (isOpen) => set({ isPatchNotesOpen: isOpen }),
      setInitialPatchNotesVersion: (version) => set({ initialPatchNotesVersion: version }),

      // --- Dialogs ---
      setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setInfoOpen: (isOpen) => set({ isInfoOpen: isOpen }),
      setCardDialogOpen: (isOpen) => set({ isCardDialogOpen: isOpen }),
      setWelcomeDialogOpen: (isOpen) => set({ isWelcomeDialogOpen: isOpen }),
      setLegacyDataDialogOpen: (isOpen) => set({ isLegacyDataDialogOpen: isOpen }),

      // --- App Tour ---
      setTourOpen: (isOpen) => set({ isTourOpen: isOpen }),

      // --- Sidebar Actions ---
      setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
      toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      // --- Edit Mode ---
      setIsEditing: (isEditing) => set({ isEditing }),
      toggleIsEditing: () => set((state) => ({ isEditing: !state.isEditing })),

      // --- Drawer ---
      setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
   },
}));



export const useAppGeneralStateActions = () => useAppGeneralStateStore((state) => state.actions);