// -- Store Imports --
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

/**
 * The app-chrome flags captured when a tutorial starts and restored verbatim when it ends. A run
 * opens panels, enters Edit mode, and walks the settings sections; on exit the snapshot puts every
 * one of those flags back to where the user had them, so the app returns to exactly its pre-tutorial
 * state (never left in Edit mode or with panels flung open). UI state only - no repository write, and
 * nothing persisted beyond each flag's own home store.
 */
export interface ChromeSnapshot {
   isEditing: boolean;
   isDrawerOpen: boolean;
   isSettingsOpen: boolean;
   settingsInitialSection: string | null;
   isCommandPaletteOpen: boolean;
   navigatorOpen: boolean;
   diceTrayOpen: boolean;
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
}
