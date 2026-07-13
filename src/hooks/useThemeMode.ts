// -- React Imports --
import { useSyncExternalStore } from 'react';

// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { resolveThemeMode, type ResolvedMode, type ThemeMode } from '@/lib/theme/themeMode';



const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

/** Subscribe to OS light/dark changes so `resolvedMode` stays live while in `system`. */
function subscribeSystemPref(callback: () => void): () => void {
   const query = window.matchMedia(PREFERS_DARK_QUERY);
   query.addEventListener('change', callback);
   return () => query.removeEventListener('change', callback);
}

function getSystemPrefersDark(): boolean {
   return window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/**
 * The light/dark mode, backed by `appSettingsStore` (replaces next-themes' `useTheme`). `resolvedMode` is the
 * applied light/dark - it follows the OS reactively while the mode is `system`. `setMode` writes the chosen mode.
 */
export function useThemeMode(): { mode: ThemeMode; resolvedMode: ResolvedMode; setMode: (mode: ThemeMode) => void } {
   const mode = useAppSettingsStore((state) => state.themeMode);
   const setMode = useAppSettingsStore((state) => state.actions.setThemeMode);
   const systemPrefersDark = useSyncExternalStore(subscribeSystemPref, getSystemPrefersDark, () => false);
   return { mode, resolvedMode: resolveThemeMode(mode, systemPrefersDark), setMode };
}
