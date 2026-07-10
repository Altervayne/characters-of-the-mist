// -- React Imports --
import { useTranslation } from 'react-i18next';

// -- Icon Imports --
import { LoaderCircle } from 'lucide-react';

/**
 * Full-screen neutral loading shell shown while the active character is read from
 * IndexedDB at boot. It exists so first paint never flashes the main
 * menu before the asynchronous load resolves into the character sheet. Background
 * matches the app shell so the transition into either the sheet or the menu is
 * seamless.
 */
export function CharacterBootLoading() {
   const { t } = useTranslation();

   return (
      <div
         className="flex flex-col items-center justify-center gap-4 bg-background text-muted-foreground"
         style={{ height: '100dvh', width: '100dvw' }}
      >
         <LoaderCircle className="h-8 w-8 animate-spin" />
         <span className="text-sm">{t('Loading.boot')}</span>
      </div>
   );
}
