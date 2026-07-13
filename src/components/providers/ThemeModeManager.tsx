// -- React Imports --
import { useEffect } from 'react';

// -- Store and Hook Imports --
import { useAppSettingsStore } from '@/lib/stores/appSettingsStore';

// -- Theme Imports --
import { resolveThemeMode, themeModeClasses } from '@/lib/theme/themeMode';



/*
 * Owns ONLY the light/dark `dark`/`light` class on <html> (the palette `theme-*` class stays with
 * ThemeClassManager - disjoint classList ownership, so the two never fight). Mirrors ThemeClassManager's
 * shape. Replaces next-themes: the initial class is set synchronously by the inline no-flash script in
 * index.html; this manager keeps it in sync with the store and, while in `system`, follows the OS via a
 * `matchMedia` listener (subscribed only in `system` mode; the effect cleanup removes it, StrictMode-safe).
 */
export function ThemeModeManager({ children }: { children: React.ReactNode }) {
   const mode = useAppSettingsStore((state) => state.themeMode);

   useEffect(() => {
      const query = window.matchMedia('(prefers-color-scheme: dark)');

      const apply = () => {
         const { add, remove } = themeModeClasses(resolveThemeMode(mode, query.matches));
         const rootClasses = document.documentElement.classList;
         rootClasses.add(add);
         rootClasses.remove(remove);
      };

      apply();

      // A pinned light/dark mode ignores the OS; only `system` tracks it.
      if (mode !== 'system') return;
      query.addEventListener('change', apply);
      return () => query.removeEventListener('change', apply);
   }, [mode]);

   return <>{children}</>;
}
