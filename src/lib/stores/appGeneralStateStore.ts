// -- Other Library Imports --
import { create } from 'zustand';

// -- Type Imports --
import type { CreatableKind } from '@/lib/creation/creatableRegistry';



type StoreName = 'character' | 'drawer' | 'board' | 'note';

export type MobileDrawerSnapPoint = 'closed' | 'half' | 'full';

/*
 * A one-shot request the palette hands the active board (which owns the drop point, the selection, and the
 * ephemeral pointer tool): mint a challenge or a board-native element at the view center, switch the active
 * tool (`setTool:<tool>`), save the selected copy card/tracker back to the drawer / as a new drawer item, or
 * embed a saved note as a live reference tile. The canvas consumes it against its own state and clears it.
 * The `create:<kind>` members mirror the toolbar/radial's
 * `CreatableKind` set (explicit per-kind, not a free-form parameter), so a palette create can't drift from
 * the registry; `embedNote:<drawerItemId>` carries the picked note's drawer item id.
 */
export type BoardAction =
   | 'createChallenge'
   | 'setTool:select'
   | 'setTool:pen'
   | 'saveItemToDrawer'
   | 'saveItemToDrawerAs'
   | `create:${CreatableKind}`
   | `embedNote:${string}`;

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
   isThemesOpen: boolean;
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

   // Drawer. Three modes: Collapsed (!isDrawerOpen), Open (open + !expanded), Expanded (open + expanded).
   // `isDrawerExpanded` is only meaningful while open; closing clears it.
   isDrawerOpen: boolean;
   isDrawerExpanded: boolean;
   // The Expanded overlay slides aside mid-drag so an item can be dropped on the revealed workspace.
   // Only meaningful while Expanded + dragging; any contract/close clears it.
   isDrawerReceded: boolean;

   // Mobile Drawer
   mobileDrawerSnapPoint: MobileDrawerSnapPoint;

   // A one-shot request the active board consumes and clears (e.g. a palette command minting an item
   // with no cursor point to drop at, or one saving the selection to the drawer). Null when nothing is
   // pending. The canvas owns the drop point AND the selection, so the palette signals through here.
   pendingBoardAction: BoardAction | null;

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
      setThemesOpen: (isOpen: boolean) => void;
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
      setDrawerExpanded: (isExpanded: boolean) => void;
      expandDrawer: () => void;
      contractDrawer: () => void;
      setDrawerReceded: (isReceded: boolean) => void;

      // Mobile Drawer
      setMobileDrawerSnapPoint: (snapPoint: MobileDrawerSnapPoint) => void;

      // Pending board action
      requestBoardAction: (action: BoardAction) => void;
      clearBoardAction: () => void;
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
   isThemesOpen: false,
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
   isDrawerExpanded: false,
   isDrawerReceded: false,

   // Mobile Drawer
   mobileDrawerSnapPoint: 'closed',

   // Pending board action
   pendingBoardAction: null,

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
      setThemesOpen: (isOpen) => set({ isThemesOpen: isOpen }),
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

      // Drawer. Closing always drops Expanded (and any recede) too (only meaningful while open).
      setDrawerOpen: (isOpen) => set(isOpen ? { isDrawerOpen: true } : { isDrawerOpen: false, isDrawerExpanded: false, isDrawerReceded: false }),
      toggleDrawer: () => set((state) => (state.isDrawerOpen ? { isDrawerOpen: false, isDrawerExpanded: false, isDrawerReceded: false } : { isDrawerOpen: true })),
      setDrawerExpanded: (isExpanded) => set({ isDrawerExpanded: isExpanded }),
      expandDrawer: () => set({ isDrawerOpen: true, isDrawerExpanded: true, isDrawerReceded: false }),
      contractDrawer: () => set({ isDrawerExpanded: false, isDrawerReceded: false }),
      setDrawerReceded: (isReceded) => set({ isDrawerReceded: isReceded }),

      // Mobile Drawer
      setMobileDrawerSnapPoint: (snapPoint) => set({ mobileDrawerSnapPoint: snapPoint }),

      // Pending board action
      requestBoardAction: (action) => set({ pendingBoardAction: action }),
      clearBoardAction: () => set({ pendingBoardAction: null }),
   },
}));



export const useAppGeneralStateActions = () => useAppGeneralStateStore((state) => state.actions);