// -- Hook Imports --
import { useWindowSize } from '@/hooks/mobile/useWindowSize';

// -- Utils --
import { TUTORIAL_Z } from '@/lib/tutorial/zLayers';



interface TutorialOverlayProps {
   /** Padded target rect to spotlight, or `null` for a plain full-screen scrim (centered/bail step). */
   targetRect: DOMRect | null;
   padding: number;
   /** `blocked` eats every click; `anchor-only` leaves the hole clickable so a gate can fire. */
   interaction: 'blocked' | 'anchor-only';
   /** `dim` draws the veil; `none` draws no veil (coach-mark + a bare ring) so the app stays lit. */
   scrim: 'dim' | 'none';
}

const SCRIM = 'rgb(0 0 0 / 0.6)';
// Position transition so the spotlight glides as it follows the target between steps.
const FOLLOW = 'left 0.25s ease-out, top 0.25s ease-out, width 0.25s ease-out, height 0.25s ease-out';

/** Swallows a pointer event so the app beneath a blocker never receives it. */
function swallow(event: React.SyntheticEvent) {
   event.preventDefault();
   event.stopPropagation();
}

/**
 * The spotlight veil. A single box-shadow cutout is the dim: one div at the padded rect,
 * rounded to `--radius`, with a 9999px shadow spill that IS the surrounding dark. Hole and
 * ring share the radius so corners kiss (no polygon notch). Position is driven straight from
 * the rect (with a CSS transition to follow), so it re-measures every render. Interaction is
 * expressed by the step: a `blocked` step lays a full-screen click-eater over everything
 * including the hole; an `anchor-only` step blocks only a frame AROUND the hole, leaving the
 * real anchor beneath it clickable.
 */
export default function TutorialOverlay({ targetRect, padding, interaction, scrim }: TutorialOverlayProps) {
   const { width, height } = useWindowSize();

   // No-dim step: no veil, so a dialog / dropdown / dice-tray / palette the user opened stays lit and
   // visible. But we STILL block the app (below the modal layer, so those surfaces stay clickable) plus a
   // non-dimming ring at the anchor - a stray click elsewhere can't derail the step.
   if (scrim === 'none') {
      if (!targetRect) return null;
      const nLeft = Math.max(0, targetRect.left - padding);
      const nTop = Math.max(0, targetRect.top - padding);
      const nRight = Math.min(width || window.innerWidth, targetRect.right + padding);
      const nBottom = Math.min(height || window.innerHeight, targetRect.bottom + padding);
      const nWidth = Math.max(0, nRight - nLeft);
      const nHeight = Math.max(0, nBottom - nTop);
      return (
         <>
            {interaction === 'blocked' ? (
               <div className="fixed inset-0" style={{ zIndex: TUTORIAL_Z.noDimBlock }} onPointerDownCapture={swallow} onClickCapture={swallow} />
            ) : (
               <>
                  <div className="fixed" style={{ zIndex: TUTORIAL_Z.noDimBlock, left: 0, top: 0, width: '100%', height: nTop }} onPointerDownCapture={swallow} onClickCapture={swallow} />
                  <div className="fixed" style={{ zIndex: TUTORIAL_Z.noDimBlock, left: 0, top: nBottom, width: '100%', bottom: 0 }} onPointerDownCapture={swallow} onClickCapture={swallow} />
                  <div className="fixed" style={{ zIndex: TUTORIAL_Z.noDimBlock, left: 0, top: nTop, width: nLeft, height: nHeight }} onPointerDownCapture={swallow} onClickCapture={swallow} />
                  <div className="fixed" style={{ zIndex: TUTORIAL_Z.noDimBlock, left: nRight, top: nTop, right: 0, height: nHeight }} onPointerDownCapture={swallow} onClickCapture={swallow} />
               </>
            )}
            <div
               aria-hidden
               className="fixed pointer-events-none border-2 border-primary shadow-lg shadow-primary/20"
               style={{ zIndex: TUTORIAL_Z.ring, left: nLeft, top: nTop, width: nWidth, height: nHeight, borderRadius: 'var(--radius)', transition: FOLLOW }}
            />
         </>
      );
   }

   // No target yet (driving / awaiting-anchor / centered / bail): a plain dark scrim that
   // blocks the app. `anchor-only` has no hole to preserve here, so it blocks too.
   if (!targetRect) {
      return (
         <div
            className="fixed inset-0"
            style={{ zIndex: TUTORIAL_Z.scrim, backgroundColor: 'rgba(0,0,0,0.6)' }}
            onPointerDownCapture={swallow}
            onClickCapture={swallow}
         />
      );
   }

   const left = Math.max(0, targetRect.left - padding);
   const top = Math.max(0, targetRect.top - padding);
   const right = Math.min(width || window.innerWidth, targetRect.right + padding);
   const bottom = Math.min(height || window.innerHeight, targetRect.bottom + padding);
   const holeWidth = Math.max(0, right - left);
   const holeHeight = Math.max(0, bottom - top);

   return (
      <>
         {/* Dim veil: the box-shadow spill is the dark; the hole rounds for free. Never eats clicks. */}
         <div
            aria-hidden
            className="fixed pointer-events-none"
            style={{ zIndex: TUTORIAL_Z.scrim, left, top, width: holeWidth, height: holeHeight, borderRadius: 'var(--radius)', boxShadow: `0 0 0 9999px ${SCRIM}`, transition: FOLLOW }}
         />

         {interaction === 'blocked' ? (
            // Read/driven step: one click-eater over the whole viewport (the hole included).
            <div
               className="fixed inset-0"
               style={{ zIndex: TUTORIAL_Z.scrim }}
               onPointerDownCapture={swallow}
               onClickCapture={swallow}
            />
         ) : (
            // Gated step: block only the frame around the hole, so the anchor stays clickable.
            <>
               <div className="fixed" style={{ zIndex: TUTORIAL_Z.scrim, left: 0, top: 0, width: '100%', height: top }} onPointerDownCapture={swallow} onClickCapture={swallow} />
               <div className="fixed" style={{ zIndex: TUTORIAL_Z.scrim, left: 0, top: bottom, width: '100%', bottom: 0 }} onPointerDownCapture={swallow} onClickCapture={swallow} />
               <div className="fixed" style={{ zIndex: TUTORIAL_Z.scrim, left: 0, top, width: left, height: holeHeight }} onPointerDownCapture={swallow} onClickCapture={swallow} />
               <div className="fixed" style={{ zIndex: TUTORIAL_Z.scrim, left: right, top, right: 0, height: holeHeight }} onPointerDownCapture={swallow} onClickCapture={swallow} />
            </>
         )}

         {/* Spotlight halo. */}
         <div
            aria-hidden
            className="fixed pointer-events-none border-2 border-primary shadow-lg shadow-primary/20"
            style={{ zIndex: TUTORIAL_Z.ring, left, top, width: holeWidth, height: holeHeight, borderRadius: 'var(--radius)', transition: FOLLOW }}
         />
      </>
   );
}
