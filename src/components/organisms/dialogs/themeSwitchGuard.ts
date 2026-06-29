// -- React Imports --
import { createContext, useContext } from 'react';

// -- Type Imports --
import type { Context } from 'react';

/**
 * A guard the Themes window provides to everything that switches the active theme (selecting a row,
 * Duplicate, New, Import, the preset placeholder). It runs `proceed` straight away when there are no unsaved
 * edits, and otherwise asks to confirm first - so abandoning a dirty draft always prompts, whatever the
 * trigger. The default (no provider) just runs `proceed`, so these controls still work outside the dialog.
 */
export type GuardedThemeSwitch = (proceed: () => void) => void;

const ThemeSwitchGuardContext: Context<GuardedThemeSwitch> = createContext<GuardedThemeSwitch>((proceed) => proceed());

export const ThemeSwitchGuardProvider = ThemeSwitchGuardContext.Provider;
export const useThemeSwitchGuard = (): GuardedThemeSwitch => useContext(ThemeSwitchGuardContext);
