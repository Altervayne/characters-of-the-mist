// -- Icon Imports --
import { LoaderCircle } from 'lucide-react';

/**
 * Full-screen neutral loading shell shown while the active character is read from
 * IndexedDB at boot (spec §5, C-4). It exists so first paint never flashes the main
 * menu before the asynchronous load resolves into the character sheet. Background
 * matches the app shell so the transition into either the sheet or the menu is
 * seamless.
 */
export function CharacterBootLoading() {
   return (
      <div
         className="flex items-center justify-center bg-background text-muted-foreground"
         style={{ height: '100dvh', width: '100dvw' }}
      >
         <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
   );
}
