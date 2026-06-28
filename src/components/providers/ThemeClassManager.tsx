// -- React Imports --
import { useEffect } from 'react';

// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { CUSTOM_THEME_STYLE_ID, resolveActiveTheme } from '@/lib/theme/themeTokens';



export function ThemeClassManager({ children }: { children: React.ReactNode }) {
   const theme = useAppSettingsStore((state) => state.theme);
   const customThemes = useAppSettingsStore((state) => state.customThemes);

   useEffect(() => {
      // A preset injects no CSS (its rules live in global.css); a custom theme injects its light + dark
      // vars into one managed <style>. Both end up as a single `theme-*` class on <html>. Re-runs on
      // customThemes too, so editing the active custom theme's values re-injects live.
      const { className, css, isStale } = resolveActiveTheme(theme, customThemes);

      let styleEl = document.getElementById(CUSTOM_THEME_STYLE_ID) as HTMLStyleElement | null;
      if (!styleEl) {
         styleEl = document.createElement('style');
         styleEl.id = CUSTOM_THEME_STYLE_ID;
         document.head.appendChild(styleEl);
      }
      // Emptied for presets / stale themes, so a switch never leaves stale custom rules behind.
      styleEl.textContent = css;

      const rootClasses = document.documentElement.classList;
      Array.from(rootClasses)
         .filter((name) => name.startsWith('theme-'))
         .forEach((name) => rootClasses.remove(name));
      rootClasses.add(className);

      // The active theme pointed at a custom theme that no longer exists; correct the store to the fallback.
      if (isStale) useAppSettingsStore.getState().actions.setTheme('theme-neutral');
   }, [theme, customThemes]);

   return <>{children}</>;
}
