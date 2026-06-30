// -- React Imports --
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// -- Library Imports --
import cuid from 'cuid';
import toast from 'react-hot-toast';

// -- Utils Imports --
import { isExportedCustomTheme } from '@/lib/utils/export-import';
import { customThemeClass } from '@/lib/theme/themeTokens';

// -- Store Imports --
import { useAppSettingsActions } from '@/lib/stores/appSettingsStore';

// -- Type Imports --
import type { ExportFile } from '@/lib/utils/export-import';
import type { CustomTheme } from '@/lib/theme/themeTokens';

/**
 * The one place a custom theme is imported, shared by every entry point (manager button, workspace drop,
 * Themes-window drop). Given an already-parsed envelope: if it's a theme, add it with a fresh id (so the
 * same file never collides with an existing theme), select it, and report success; otherwise report failure.
 * Returns whether a theme was imported, so a caller can decide what to do with a rejected file.
 */
export function useThemeImport() {
   const { t } = useTranslation();
   const { addCustomTheme, setTheme } = useAppSettingsActions();

   return useCallback((file: ExportFile): boolean => {
      if (!isExportedCustomTheme(file)) {
         toast.error(t('Notifications.general.importFailed'));
         return false;
      }
      // Fresh id so the same file never collides; the envelope already carried paper (validated above).
      const content = file.content as CustomTheme;
      const theme: CustomTheme = { ...content, id: cuid(), paper: { ...content.paper } };
      addCustomTheme(theme);
      setTheme(customThemeClass(theme.id));
      toast.success(t('Notifications.theme.imported'));
      return true;
   }, [addCustomTheme, setTheme, t]);
}
