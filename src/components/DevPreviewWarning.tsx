// -- Icon Imports --
import { AlertTriangle } from 'lucide-react';

/*
 * The dev-preview build is compiled with VITE_DEV_PREVIEW=true (Vite INLINES env vars at build time, so this
 * is baked per-build). Production builds leave it unset, so IS_DEV_PREVIEW is false, the component renders
 * nothing, and the branch dead-code-eliminates. (A window.location.hostname check would be the way to toggle
 * per-domain without separate builds, but the owner asked for an env var, so it's the env var.)
 */
export const IS_DEV_PREVIEW = import.meta.env.VITE_DEV_PREVIEW === 'true';

/** The warning every tester must read: hardcoded (dev-only), never themed, never translated. */
const WARNING_TEXT = 'THIS IS A DEV PREVIEW. IT IS UNSTABLE, IT CAN AND WILL BREAK. DATA LOSS IS ALMOST GUARANTEED.';
const WARNING_LINK = 'FOR THE STABLE APP, CLICK HERE';

/**
 * An unmissable, env-gated warning for the dev-preview domain: a red hazard frame around the whole viewport
 * plus a top banner. Uses FIXED colors (never theme tokens), so no custom theme can tone it down. The banner
 * is an in-flow row that RESERVES its own height (the app root is a flex column below it), so it pushes the
 * app down instead of covering the tab strip - and it handles wrapping on a narrow phone for free. Renders
 * nothing when the flag is off, leaving the layout untouched.
 */
export function DevPreviewWarning() {
   if (!IS_DEV_PREVIEW) return null;

   return (
      <>
         {/* Hazard frame around the viewport. pointer-events-none so it never eats a click; above everything
             so no theme surface can hide it. The app shell reserves a matching 6px gutter (see App), so this
             border sits in that gutter and frames the app instead of overlapping its edges. */}
         <div className="pointer-events-none fixed inset-0 z-[9998] border-[3px] border-orange-600" />

         {/* Top banner: an in-flow, non-shrinking row below the top safe-area inset. Wears the frame's own
             6px red-600 border so it reads as part of the hazard frame, with a slightly deeper, still-frosted
             red fill for contrast against that border. A hazard icon, non-dismissible. */}
         <div className="pt-safe relative z-[9999] shrink-0 border-[3px] border-orange-600 bg-orange-700/85 text-white shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-center gap-2 px-4 py-2.5 text-center">
               <AlertTriangle className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
               <p className="text-xs font-bold uppercase leading-tight tracking-wide sm:text-sm">
                  {WARNING_TEXT} <a className="underline" href="https://mist.altervayne.io/">{WARNING_LINK}</a>
               </p>
            </div>
         </div>
      </>
   );
}
