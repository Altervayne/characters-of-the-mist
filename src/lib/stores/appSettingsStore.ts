// -- Other Library Imports --
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// -- Types Imports --
import type { GameSystem } from '../types/drawer';
import type { DiceTrayContent } from '@/lib/dice/diceTrayTypes';
import type { CustomTheme } from '@/lib/theme/themeTokens';



export type ThemeName = 'theme-neutral' | 'theme-legends' | 'theme-otherscape' | 'theme-city-of-mist';
/** The active theme: a preset class, or a custom theme's `theme-custom-{id}` (its value IS its class). */
export type ActiveTheme = ThemeName | `theme-custom-${string}`;
export type DeviceType = 'mobile' | 'desktop';
export type MobileHandedness = 'left' | 'right';

interface AppSettingsState {
   theme: ActiveTheme;
   /** User-defined themes (applied at runtime by the ThemeClassManager). Dormant until the editor ships. */
   customThemes: CustomTheme[];
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
      setTheme: (theme: ActiveTheme) => void;
      addCustomTheme: (theme: CustomTheme) => void;
      updateCustomTheme: (id: string, patch: Partial<CustomTheme>) => void;
      deleteCustomTheme: (id: string) => void;
      reorderCustomThemes: (activeId: string, overId: string) => void;
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
         customThemes: [],
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
            addCustomTheme: (theme) => set((state) => ({ customThemes: [...state.customThemes, theme] })),
            updateCustomTheme: (id, patch) => set((state) => ({
               customThemes: state.customThemes.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
            })),
            // Drop the theme; if it was the active one, fall back to a preset so the app stays themed.
            deleteCustomTheme: (id) => set((state) => ({
               customThemes: state.customThemes.filter((entry) => entry.id !== id),
               theme: state.theme === `theme-custom-${id}` ? 'theme-neutral' : state.theme,
            })),
            // Move a custom theme to another's slot (drag-to-reorder); the array IS the persisted order.
            reorderCustomThemes: (activeId, overId) => set((state) => {
               const from = state.customThemes.findIndex((entry) => entry.id === activeId);
               const to = state.customThemes.findIndex((entry) => entry.id === overId);
               if (from === -1 || to === -1 || from === to) return {};
               const next = state.customThemes.slice();
               const [moved] = next.splice(from, 1);
               next.splice(to, 0, moved);
               return { customThemes: next };
            }),
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
            customThemes: state.customThemes,
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