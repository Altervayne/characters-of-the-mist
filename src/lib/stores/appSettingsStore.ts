// -- Other Library Imports --
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// -- Types Imports --
import type { GameSystem } from '../types/drawer';
import type { ToolbeltMode } from '../types/toolbelt';



export type ThemeName = 'theme-neutral' | 'theme-legends' | 'theme-otherscape' | 'theme-city-of-mist';
export type DeviceType = 'mobile' | 'desktop';
export type MobileNavigationType = 'bottom-tabs' | 'fab';

interface AppSettingsState {
   theme: ThemeName;
   isCompactDrawer: boolean;
   isSideBySideView: boolean;
   lastVisitedVersion: string;
   isTrackersAlwaysEditable: boolean;
   isSidebarCollapsed: boolean;
   contextualGame: GameSystem;
   deviceTypeOverride?: DeviceType;
   mobileNavigationType: MobileNavigationType;
   mobileToolbeltMode: ToolbeltMode;
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
      setMobileNavigationType: (navType: MobileNavigationType) => void;
      setMobileToolbeltMode: (mode: ToolbeltMode) => void;
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
         mobileNavigationType: 'bottom-tabs',
         mobileToolbeltMode: 'side-panel',
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
            setMobileNavigationType: (navType) => set({ mobileNavigationType: navType }),
            setMobileToolbeltMode: (mode) => set({ mobileToolbeltMode: mode })
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
            mobileNavigationType: state.mobileNavigationType,
            mobileToolbeltMode: state.mobileToolbeltMode
         }),
      }
   )
);

export const useAppSettingsActions = () => useAppSettingsStore((state) => state.actions);