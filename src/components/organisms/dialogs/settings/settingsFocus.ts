// -- React Imports --
import { createContext, useContext } from 'react';

// -- Type Imports --
import type { GuardedThemeSwitch } from '@/components/organisms/dialogs/themeSwitchGuard';

/**
 * The bridge between the Settings hub shell and a pane that takes the whole hub over (today: the Appearance
 * pane's theme editor). A pane raises `editorOpen` to hide the rail + widen the dialog, and registers a close
 * guard so leaving the hub with an unsaved draft confirms first (the guard itself lives in the pane, which owns
 * the draft). The default (no provider) is inert, so a pane still renders fine outside the hub.
 */
export interface SettingsFocusValue {
   editorOpen: boolean;
   setEditorOpen: (open: boolean) => void;
   registerCloseGuard: (guard: GuardedThemeSwitch | null) => void;
}

const SettingsFocusContext = createContext<SettingsFocusValue>({
   editorOpen: false,
   setEditorOpen: () => {},
   registerCloseGuard: () => {},
});

export const SettingsFocusProvider = SettingsFocusContext.Provider;
export const useSettingsFocus = (): SettingsFocusValue => useContext(SettingsFocusContext);
