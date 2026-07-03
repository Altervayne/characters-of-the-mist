// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { LifeBuoy } from 'lucide-react';

/*
 * The shared reset banner for the mobile themes surfaces. FIXED colors on purpose: a broken custom theme
 * previews app-wide, so its reset must never be able to hide behind the theme it broke. No chrome tokens,
 * no dark variant. Behavior lives in each caller's onReset; the look is shared so the two can't drift.
 */
export function EscapeHatchBanner({ onReset }: { onReset: () => void }) {
   const { t } = useTranslation();
   return (
      <button
         type="button"
         onClick={onReset}
         className="flex w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-neutral-300 bg-white p-2 text-md font-medium text-neutral-900 shadow-md"
      >
         <LifeBuoy className="h-7 w-7" />
         <span className=" w-full whitespace-normal text-center">{t('SettingsDialog.themes.escapeHatch')}</span>
      </button>
   );
}
