// -- React Imports --
import { useEffect } from 'react';

// -- Store Imports --
import { useTutorialStore } from '@/lib/tutorial/tutorialStore';
import { useAppGeneralStateStore } from '@/lib/stores/appGeneralStateStore';

// Below the tutorial scrim (1100) so a spotlight can dim over these, above the settings
// dialog so the driven-step anchor is visible in the cut hole.
const PROBE_Z = 1050;

/**
 * Dev-only scaffolding that drives the throwaway `dev.proof` tutorial end to end, with no
 * production residue (mounted only on the dev-preview build). The DRIVEN-step anchor mounts
 * only once the drive has opened the settings hub, so the runner must await the drive before
 * it can anchor; the GATED-step anchor is always present and clicked through the `anchor-only`
 * cutout. Also exposes `window.__cotmTutorialProof()` for console triggering.
 */
export default function TutorialDevProbe() {
   const start = useTutorialStore((state) => state.actions.start);
   const isSettingsOpen = useAppGeneralStateStore((state) => state.isSettingsOpen);

   useEffect(() => {
      const globalScope = window as unknown as { __cotmTutorialProof?: () => void; __cotmTutorialDegrade?: () => void };
      globalScope.__cotmTutorialProof = () => start('dev.proof', 'settings');
      globalScope.__cotmTutorialDegrade = () => start('dev.degrade', 'settings');
      return () => {
         delete globalScope.__cotmTutorialProof;
         delete globalScope.__cotmTutorialDegrade;
      };
   }, [start]);

   return (
      <>
         <button
            onClick={() => start('dev.proof', 'settings')}
            style={{ position: 'fixed', left: 8, bottom: 8, zIndex: PROBE_Z }}
            className="rounded bg-primary text-primary-foreground text-xs px-2 py-1 shadow cursor-pointer"
         >
            Run tutorial proof
         </button>

         <button
            data-tutorial="dev.gated"
            style={{ position: 'fixed', left: 8, bottom: 44, zIndex: PROBE_Z }}
            className="rounded bg-secondary text-secondary-foreground text-xs px-2 py-1 shadow cursor-pointer"
         >
            Proof gate target
         </button>

         {isSettingsOpen && (
            <div
               data-tutorial="dev.driven"
               style={{ position: 'fixed', right: 16, top: 96, zIndex: PROBE_Z }}
               className="rounded bg-card border border-primary text-card-foreground text-xs px-3 py-2 shadow"
            >
               Driven-step anchor
            </div>
         )}
      </>
   );
}
