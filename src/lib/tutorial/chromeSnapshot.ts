// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { ActiveTheme } from '@/lib/stores/appSettingsStore';
import type { ThemeMode } from '@/lib/theme/themeMode';

/**
 * The app-chrome flags captured when a tutorial starts and restored verbatim when it ends. A run
 * opens panels, enters Edit mode, walks the settings sections, and (the themes tour) applies a preset;
 * on exit the snapshot puts every one of those back to where the user had them, so the app returns to
 * exactly its pre-tutorial state (never left in Edit mode, with panels flung open, or re-skinned). Most
 * fields are UI-only flags that persist no further than their home store; `theme` + `themeMode` are the
 * exception - they ARE persisted, so restoring them writes localStorage, a net-zero revert of the tour's
 * own preset apply. The active custom themes list is never touched, so a custom built mid-tour survives.
 */
export interface ChromeSnapshot {
   isEditing: boolean;
   isDrawerOpen: boolean;
   isSettingsOpen: boolean;
   settingsInitialSection: string | null;
   isCommandPaletteOpen: boolean;
   navigatorOpen: boolean;
   diceTrayOpen: boolean;
   theme: ActiveTheme;
   themeMode: ThemeMode;
}

/** Reads the current app-chrome flags fresh off the stores. */
export function captureChromeSnapshot(): ChromeSnapshot {
   const general = useAppGeneralStateStore.getState();
   const settings = useAppSettingsStore.getState();
   return {
      isEditing: general.isEditing,
      isDrawerOpen: general.isDrawerOpen,
      isSettingsOpen: general.isSettingsOpen,
      settingsInitialSection: general.settingsInitialSection,
      isCommandPaletteOpen: general.isCommandPaletteOpen,
      navigatorOpen: settings.navigatorOpen,
      diceTrayOpen: settings.diceTray.isOpen,
      theme: settings.theme,
      themeMode: settings.themeMode,
   };
}

/** Sets every captured flag back to its snapshot value. Idempotent. */
export function restoreChromeSnapshot(snapshot: ChromeSnapshot): void {
   const general = useAppGeneralStateStore.getState().actions;
   const settings = useAppSettingsStore.getState().actions;
   general.setIsEditing(snapshot.isEditing);
   general.setDrawerOpen(snapshot.isDrawerOpen);
   general.setSettingsOpen(snapshot.isSettingsOpen);
   general.setSettingsInitialSection(snapshot.settingsInitialSection);
   general.setCommandPaletteOpen(snapshot.isCommandPaletteOpen);
   settings.setNavigatorOpen(snapshot.navigatorOpen);
   settings.setDiceTrayOpen(snapshot.diceTrayOpen);
   // Persisted, unlike the flags above: revert the tour's preset apply (theme + mode) and drop any draft the
   // user left open. The custom themes list is deliberately untouched, so a custom built mid-tour is kept.
   settings.setTheme(snapshot.theme);
   settings.setThemeMode(snapshot.themeMode);
   settings.discardThemeDraft();
}
