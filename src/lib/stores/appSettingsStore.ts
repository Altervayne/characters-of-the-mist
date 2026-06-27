// -- Other Library Imports --
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// -- Types Imports --
import type { GameSystem } from '../types/drawer';
import type { DiceTrayContent } from '@/lib/dice/diceTrayTypes';



export type ThemeName = 'theme-neutral' | 'theme-legends' | 'theme-otherscape' | 'theme-city-of-mist';
export type DeviceType = 'mobile' | 'desktop';
export type MobileHandedness = 'left' | 'right';

interface AppSettingsState {
   theme: ThemeName;
   isCompactDrawer: boolean;
   isSideBySideView: boolean;
   lastVisitedVersion: string;
   isTrackersAlwaysEditable: boolean;
   isSidebarCollapsed: boolean;
   contextualGame: GameSystem;
   deviceTypeOverride?: DeviceType;
   isMobileFABMode: boolean;
   mobileHandedness: MobileHandedness;
   areGestureHintsEnabled: boolean;
   hasSeenTrackerSelectHint: boolean;
   hasSeenDrawerMenuHint: boolean;
   // The app-wide dice tray (a bottom sliding panel, reachable from any tab). Persisted, no undo: edits
   // and rolls write straight to `content`, so the configured dice/modifiers and the last roll survive a
   // reload. `isOpen` is the panel's slide state.
   diceTray: { content: DiceTrayContent; isOpen: boolean };
   actions: {
      setTheme: (theme: ThemeName) => void;
      toggleCompactDrawer: () => void;
      setSideBySideView: (isSideBySide: boolean) => void;
      setLastVisitedVersion: (version: string) => void;
      setTrackersAlwaysEditable: (isEditable: boolean) => void;
      setSidebarCollapsed: (isCollapsed: boolean) => void;
      toggleSidebarCollapsed: () => void;
      setContextualGame: (game: GameSystem) => void;
      setDeviceTypeOverride: (deviceType: DeviceType | undefined) => void;
      setMobileFABMode: (enabled: boolean) => void;
      setMobileHandedness: (handedness: MobileHandedness) => void;
      setGestureHintsEnabled: (enabled: boolean) => void;
      setHasSeenTrackerSelectHint: (seen: boolean) => void;
      setHasSeenDrawerMenuHint: (seen: boolean) => void;
      setDiceTrayContent: (content: DiceTrayContent) => void;
      toggleDiceTray: () => void;
      setDiceTrayOpen: (isOpen: boolean) => void;
   };
}



export const useAppSettingsStore = create<AppSettingsState>()(
   persist(
      (set) => ({
         theme: 'theme-neutral',
         isCompactDrawer: false,
         isSideBySideView: false,
         lastVisitedVersion: "0.0.0",
         isTrackersAlwaysEditable: false,
         isSidebarCollapsed: false,
         contextualGame: 'LEGENDS',
         deviceTypeOverride: undefined,
         isMobileFABMode: false,
         mobileHandedness: 'right',
         areGestureHintsEnabled: true,
         hasSeenTrackerSelectHint: false,
         hasSeenDrawerMenuHint: false,
         diceTray: { content: { dice: [], modifiers: [] }, isOpen: false },
         actions: {
            setTheme: (theme) => set({ theme }),
            toggleCompactDrawer: () => set((state) => ({ isCompactDrawer: !state.isCompactDrawer })),
            setSideBySideView: (isSideBySide) => set({ isSideBySideView: isSideBySide }),
            setLastVisitedVersion: (version) => set({ lastVisitedVersion: version }),
            setTrackersAlwaysEditable: (isEditable) => set({ isTrackersAlwaysEditable: isEditable }),
            setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
            toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
            setContextualGame: (game) => set({ contextualGame: game }),
            setDeviceTypeOverride: (deviceType) => set({ deviceTypeOverride: deviceType }),
            setMobileFABMode: (enabled) => set({ isMobileFABMode: enabled }),
            setMobileHandedness: (handedness) => set({ mobileHandedness: handedness }),
            setGestureHintsEnabled: (enabled) => set({ areGestureHintsEnabled: enabled }),
            setHasSeenTrackerSelectHint: (seen) => set({ hasSeenTrackerSelectHint: seen }),
            setHasSeenDrawerMenuHint: (seen) => set({ hasSeenDrawerMenuHint: seen }),
            // No undo: edits and rolls both write straight to content; the persist middleware saves it.
            setDiceTrayContent: (content) => set((state) => ({ diceTray: { ...state.diceTray, content } })),
            toggleDiceTray: () => set((state) => ({ diceTray: { ...state.diceTray, isOpen: !state.diceTray.isOpen } })),
            setDiceTrayOpen: (isOpen) => set((state) => ({ diceTray: { ...state.diceTray, isOpen } })),
         },
      }),
      {
         name: 'characters-of-the-mist_app-settings',
         storage: createJSONStorage(() => localStorage),
         partialize: (state) => ({
            theme: state.theme,
            isCompactDrawer: state.isCompactDrawer,
            isSideBySideView: state.isSideBySideView,
            lastVisitedVersion: state.lastVisitedVersion,
            isTrackersAlwaysEditable: state.isTrackersAlwaysEditable,
            isSidebarCollapsed: state.isSidebarCollapsed,
            contextualGame: state.contextualGame,
            deviceTypeOverride: state.deviceTypeOverride,
            isMobileFABMode: state.isMobileFABMode,
            mobileHandedness: state.mobileHandedness,
            areGestureHintsEnabled: state.areGestureHintsEnabled,
            hasSeenTrackerSelectHint: state.hasSeenTrackerSelectHint,
            hasSeenDrawerMenuHint: state.hasSeenDrawerMenuHint,
            diceTray: state.diceTray
         }),
      }
   )
);

export const useAppSettingsActions = () => useAppSettingsStore((state) => state.actions);