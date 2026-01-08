// -- Other Library Imports --
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// -- Types Imports --
import type { GameSystem } from '../types/drawer';



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
            setMobileHandedness: (handedness) => set({ mobileHandedness: handedness })
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
            mobileHandedness: state.mobileHandedness
         }),
      }
   )
);

export const useAppSettingsActions = () => useAppSettingsStore((state) => state.actions);