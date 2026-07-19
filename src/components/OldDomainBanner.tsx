// -- Icon Imports --
import { Rocket, ArrowRight } from 'lucide-react';

/**
 * Build-time switch, off by default: the banner only shows when the deployment sets
 * `VITE_SHOW_OLD_DOMAIN_BANNER=true`. This lets the 2.0 update ship to the current domain with the banner
 * dormant, then flip on (a rebuild with the flag set) once the migration push is ready. Vite inlines the env
 * value at build time, so when it's off the whole banner below is dead-code-eliminated from the bundle.
 */
const BANNER_ENABLED = import.meta.env.VITE_SHOW_OLD_DOMAIN_BANNER === 'true';

/**
 * A permanent, non-dismissable "we've moved" banner for the frozen old-domain (1.x) deployment. The app has
 * been rebranded to Campaigns of the Mist and now lives at a new domain, so this points users there and
 * reminds them to export their Drawer first, so nobody leaves their data behind on a version that will no
 * longer be updated.
 *
 * It renders as the top row of the app shell (App.tsx wraps the router below it) and reserves its own height
 * rather than overlaying, so it never hides the sidebar / header controls a user needs to reach the export.
 * It carries the top safe-area inset so it clears a mobile notch. English only by design: it is a temporary
 * migration notice, and the other locales fall back to this text.
 */
export function OldDomainBanner() {
   if (!BANNER_ENABLED) return null;

   return (
      <div
         role="alert"
         // Inverted foreground/background so the bar is a high-contrast notification strip in EVERY theme and
         // in both light/dark - a migration notice a user can't afford to miss shouldn't ride the (sometimes
         // subtle) primary accent, which goes near-white on the neutral menu theme.
         className="shrink-0 bg-foreground text-background shadow-md"
         style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
         <div className="mx-auto flex max-w-5xl flex-col items-center gap-2.5 px-4 py-2.5 text-center sm:flex-row sm:justify-between sm:gap-4 sm:text-left">
            <div className="flex items-center gap-2.5">
               <Rocket className="h-5 w-5 shrink-0" aria-hidden />
               <p className="text-sm leading-snug">
                  <span className="font-semibold">Characters of the Mist is now Campaigns of the Mist.</span>{' '}
                  This version will no longer be updated. Export your Drawer to keep your data, then head over to the new site.
               </p>
            </div>

            <a
               href="https://www.campaignsofthemist.app/"
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-opacity hover:opacity-90"
            >
               Open campaignsofthemist.app
               <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
         </div>
      </div>
   );
}
